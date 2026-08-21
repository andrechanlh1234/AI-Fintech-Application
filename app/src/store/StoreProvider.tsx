import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import type { AppState, ManualData, BalanceDraft } from './types';
import { reducer, type Action } from './reducer';
import { buildInitialState, mergePersisted, persistState, clearPersisted, buildSyncPayload } from './initialState';
import { aiCraftReply } from '../lib/seedData';
import { computeNetWorthTimeline, selectAiContext } from './selectors';
import {
  getToken, fetchMe, fetchRemoteState, pushRemoteState, scanReceiptImage, captureOAuthTokenFromUrl,
  signup as apiSignup, login as apiLogin, logout as apiLogout,
  forgotPassword as apiForgotPassword, resetPassword as apiResetPassword, readResetTokenFromUrl,
  requestAiReply, uploadStatement, type ScannedStatementRecord,
} from '../lib/api';
import { isoToDisplayDate } from '../lib/format';
import { uid } from '../lib/ids';
import { mapOcrCategory } from '../lib/constants';
import type { ReviewItem } from '../lib/seedData';

const StoreContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    ...mergePersisted(buildInitialState()),
    resetToken: readResetTokenFromUrl(), // ?reset_token=... from a password-reset email link
  }));

  useEffect(() => {
    const t = setTimeout(() => dispatch({ type: 'SET_MOUNTED' }), 60);
    return () => clearTimeout(t);
  }, []);

  // Restore a signed-in session on load: validate the saved token, then
  // pull whatever this account last synced (overwriting the local-only
  // state a guest may have accumulated before signing in).
  useEffect(() => {
    const justSignedInViaGoogle = captureOAuthTokenFromUrl(); // picks up ?oauth_token= from a Google-login redirect, if present
    if (!getToken()) return;
    (async () => {
      try {
        const user = await fetchMe();
        dispatch({ type: 'SET_AUTH_USER', user });
        const remote = await fetchRemoteState();
        if (remote) dispatch({ type: 'APPLY_REMOTE_STATE', payload: remote });
        if (justSignedInViaGoogle) dispatch({ type: 'OAUTH_LOGIN_COMPLETE' });
      } catch {
        apiLogout(); // expired/invalid token — fall back to local-only silently
      }
    })();
  }, []);

  useEffect(() => {
    persistState(state);
    // Persist whenever any user-editable slice of state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ob.manual, state.ob.subs, state.finance.buckets, state.appStage, state.theme, state.netWorthSeed, state.transactions, state.netWorthHistory, state.userMode]);

  // Recompute the real net-worth timeline whenever a dated balance row or
  // entry changes — this is what makes the Finance > Net worth chart plot
  // real movement on the date each change actually happened (a backdated
  // "as of" date on a manual row, or a dated Add/Deduct-money entry) instead
  // of always stamping everything as "today". See computeNetWorthTimeline.
  useEffect(() => {
    dispatch({ type: 'SET_NET_WORTH_HISTORY', history: computeNetWorthTimeline(state) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ob.manual, state.netWorthSeed]);

  // Once signed in, also mirror every change to the backend (debounced —
  // syncing on every keystroke would be wasteful and can race).
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!state.authUser) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    const payload = buildSyncPayload(state);
    pushTimer.current = setTimeout(() => {
      pushRemoteState(payload).catch(() => { /* offline / server down — localStorage still has it */ });
    }, 800);
    return () => { if (pushTimer.current) clearTimeout(pushTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ob.manual, state.ob.subs, state.finance.buckets, state.appStage, state.theme, state.netWorthSeed, state.transactions, state.netWorthHistory, state.userMode, state.authUser]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

type ManualListKey = keyof ManualData;

/**
 * Bound action creators mirroring Cukai v7.dc.html's Component methods 1:1
 * (goHome, setOb, addBucketItem, ...), so screen components read like the
 * original template's `{{methodName}}` bindings. Setters take resolved
 * values, not raw events — call as `actions.setOb('name', e.target.value)`.
 */
export function useActions() {
  const { state, dispatch } = useStore();

  return useMemo(() => {
    return {
      // onboarding
      setOb: (field: string, value: unknown) => dispatch({ type: 'SET_OB_FIELD', field, value }),
      setObOther: (field: string, value: string) => dispatch({ type: 'SET_OB_OTHER', field, value }),
      toggleObArray: (field: 'incomeTypes' | 'reliefs' | 'goals', value: string) => dispatch({ type: 'TOGGLE_OB_ARRAY', field, value }),
      obNext: (nextStep: string) => dispatch({ type: 'OB_NEXT', nextStep }),
      obBack: (prevStep: string) => dispatch({ type: 'OB_BACK', prevStep }),
      obFinish: () => dispatch({ type: 'OB_FINISH' }),
      toggleAgreedTerms: () => dispatch({ type: 'TOGGLE_AGREED_TERMS' }),
      chooseLinkMethod: (nextStep: string) => dispatch({ type: 'CHOOSE_SETUP_METHOD', method: 'link', nextStep }),
      chooseManualMethod: (nextStep: string) => dispatch({ type: 'CHOOSE_SETUP_METHOD', method: 'manual', nextStep }),
      toggleLinkTarget: (id: string) => {
        if (state.ob.linkedIds.includes(id)) {
          dispatch({ type: 'TOGGLE_LINK_TARGET_REMOVE', id });
          return;
        }
        dispatch({ type: 'TOGGLE_LINK_TARGET_START', id });
        setTimeout(() => dispatch({ type: 'TOGGLE_LINK_TARGET_COMPLETE', id }), 900);
      },
      resetOnboarding: () => {
        clearPersisted();
        window.location.reload();
      },
      loadTrialData: () => dispatch({ type: 'LOAD_TRIAL_DATA' }),
      clearAllData: () => dispatch({ type: 'CLEAR_ALL_DATA' }),

      // navigation
      goHome: () => dispatch({ type: 'GO_TAB', tab: 'home' }),
      goFinance: () => dispatch({ type: 'GO_TAB', tab: 'finance' }),
      goTax: () => dispatch({ type: 'GO_TAB', tab: 'tax' }),
      goAi: () => dispatch({ type: 'GO_TAB', tab: 'ai' }),
      openMorePanel: () => dispatch({ type: 'OPEN_MORE_PANEL' }),
      closeMorePanel: () => dispatch({ type: 'CLOSE_MORE_PANEL' }),
      openNotifPanel: () => dispatch({ type: 'OPEN_NOTIF_PANEL' }),
      closeNotifPanel: () => dispatch({ type: 'CLOSE_NOTIF_PANEL' }),
      goFinanceNetWorth: () => dispatch({ type: 'GO_FINANCE_SECTION', section: 'networth' }),
      goFinanceTransactions: () => dispatch({ type: 'GO_FINANCE_SECTION', section: 'record' }),
      goFinanceBudgets: () => dispatch({ type: 'GO_FINANCE_SECTION', section: 'budgets' }),
      goFinanceHistory: () => dispatch({ type: 'GO_FINANCE_SECTION', section: 'history' }),
      goFinanceStats: () => dispatch({ type: 'GO_FINANCE_SECTION', section: 'stats' }),

      // net worth chart
      setNetWorthRange: (range: AppState['netWorthRange']) => dispatch({ type: 'SET_NETWORTH_RANGE', range }),
      selectNwPoint: (idx: number) => dispatch({ type: 'SELECT_NW_POINT', idx }),
      clearNwSelection: () => dispatch({ type: 'SELECT_NW_POINT', idx: null }),

      // record / history
      setHistoryMonth: (month: string) => dispatch({ type: 'SET_HISTORY_MONTH', month }),
      selectRecordDay: (month: string, day: number) => dispatch({ type: 'SELECT_RECORD_DAY', month, day }),
      setTxSearch: (value: string) => dispatch({ type: 'SET_TX_SEARCH', value }),
      setTxFilter: (value: string) => dispatch({ type: 'SET_TX_FILTER', value }),

      // stats
      setStatsPeriod: (value: string) => dispatch({ type: 'SET_STATS_PERIOD', value }),
      openStatsCategoryDetail: (cat: string) => dispatch({ type: 'OPEN_STATS_CATEGORY_DETAIL', cat }),
      closeStatsCategoryDetail: () => dispatch({ type: 'CLOSE_STATS_CATEGORY_DETAIL' }),

      // donate
      openDonate: () => dispatch({ type: 'OPEN_DONATE' }),
      closeDonate: () => dispatch({ type: 'CLOSE_DONATE' }),
      setDonateAmount: (value: string) => dispatch({ type: 'SET_DONATE_AMOUNT', value }),
      submitDonate: () => dispatch({ type: 'SUBMIT_DONATE' }),

      // relief impact preview
      toggleWhyDeductible: () => dispatch({ type: 'TOGGLE_WHY_DEDUCTIBLE' }),
      setScanPaymentMethod: (value: string) => dispatch({ type: 'SET_SCAN_PAYMENT_METHOD', value }),
      setScanTaxAmount: (value: string) => dispatch({ type: 'SET_SCAN_TAX_AMOUNT', value }),
      setScanTaxRate: (value: string) => dispatch({ type: 'SET_SCAN_TAX_RATE', value }),
      setScanTag: (value: string) => dispatch({ type: 'SET_SCAN_TAG', value }),

      // budgets
      toggleBucket: (key: string) => dispatch({ type: 'TOGGLE_BUCKET', key }),
      addBucketCategory: (bucketKey: string, name?: string, openDetail?: boolean, cap?: number) => dispatch({ type: 'ADD_BUCKET_CATEGORY', bucketKey, name, openDetail, cap }),
      removeBucketCategory: (bucketKey: string, catId: string) => dispatch({ type: 'REMOVE_BUCKET_CATEGORY', bucketKey, catId }),
      setBucketCategoryName: (bucketKey: string, catId: string, value: string) => dispatch({ type: 'SET_BUCKET_CATEGORY_NAME', bucketKey, catId, value }),
      setBucketCategoryCap: (bucketKey: string, catId: string, value: number) => dispatch({ type: 'SET_BUCKET_CATEGORY_CAP', bucketKey, catId, value }),
      addBucketItem: (bucketKey: string, catId: string) => dispatch({ type: 'ADD_BUCKET_ITEM', bucketKey, catId }),
      setBucketItemField: (bucketKey: string, catId: string, itemId: string, field: 'name' | 'amount', value: string | number) => dispatch({ type: 'SET_BUCKET_ITEM_FIELD', bucketKey, catId, itemId, field, value }),
      removeBucketItem: (bucketKey: string, catId: string, itemId: string) => dispatch({ type: 'REMOVE_BUCKET_ITEM', bucketKey, catId, itemId }),
      openBudgetItemDetail: (key: string) => dispatch({ type: 'OPEN_BUDGET_ITEM_DETAIL', key }),
      closeBudgetItemDetail: () => dispatch({ type: 'CLOSE_BUDGET_ITEM_DETAIL' }),
      toggleDonutExpanded: () => dispatch({ type: 'TOGGLE_DONUT_EXPANDED' }),

      // tax
      setYA2026: () => dispatch({ type: 'SET_TAX_YEAR', year: 'YA2026' }),
      setYA2025: () => dispatch({ type: 'SET_TAX_YEAR', year: 'YA2025' }),
      toggleTaxGroup: (key: string) => dispatch({ type: 'TOGGLE_TAX_GROUP', key }),
      openTaxItemDetail: (key: string) => dispatch({ type: 'OPEN_TAX_ITEM_DETAIL', key }),
      closeTaxItemDetail: () => dispatch({ type: 'CLOSE_TAX_ITEM_DETAIL' }),
      toggleShowAllTaxReceipts: () => dispatch({ type: 'TOGGLE_SHOW_ALL_TAX_RECEIPTS' }),
      openTaxPack: () => dispatch({ type: 'OPEN_TAX_PACK' }),
      closeTaxPack: () => dispatch({ type: 'CLOSE_TAX_PACK' }),
      upgradeFromTaxPack: () => dispatch({ type: 'UPGRADE_FROM_TAX_PACK' }),
      toggleSubscriptionTier: () => dispatch({ type: 'TOGGLE_SUBSCRIPTION_TIER' }),

      // settings
      setFaceIdOn: () => dispatch({ type: 'SET_FACE_ID', on: true }),
      setFaceIdOff: () => dispatch({ type: 'SET_FACE_ID', on: false }),
      toggleFaceId: () => dispatch({ type: 'TOGGLE_FACE_ID' }),
      toggleSetting: (key: 'budgetAlerts' | 'taxReminders' | 'weeklySummary') => dispatch({ type: 'TOGGLE_SETTING', key }),
      setThemeLight: () => dispatch({ type: 'SET_THEME', theme: 'light' }),
      setThemeDark: () => dispatch({ type: 'SET_THEME', theme: 'dark' }),

      // manual records
      addRecord: (listKey: Exclude<ManualListKey, 'investments'>) => dispatch({ type: 'ADD_RECORD', listKey }),
      setRecordField: (listKey: Exclude<ManualListKey, 'investments'>, id: string, field: 'name' | 'amount' | 'date', value: string) => dispatch({ type: 'SET_RECORD_FIELD', listKey, id, field, value }),
      removeRecord: (listKey: Exclude<ManualListKey, 'investments'>, id: string) => dispatch({ type: 'REMOVE_RECORD', listKey, id }),
      setInvestField: (idx: number, field: 'name' | 'qty' | 'buy' | 'cur', value: string) => dispatch({ type: 'SET_INVEST_FIELD', idx, field, value }),
      addInvestmentRow: () => dispatch({ type: 'ADD_INVESTMENT_ROW' }),
      removeInvestmentRow: (idx: number) => dispatch({ type: 'REMOVE_INVESTMENT_ROW', idx }),

      // subscriptions
      setSubDraft: (field: string, value: string) => dispatch({ type: 'SET_SUB_DRAFT_FIELD', field, value }),
      addSubscription: () => dispatch({ type: 'ADD_SUBSCRIPTION' }),
      removeSubscription: (idx: number) => dispatch({ type: 'REMOVE_SUBSCRIPTION', idx }),
      openAddSub: () => dispatch({ type: 'OPEN_ADD_SUB' }),
      closeAddSub: () => dispatch({ type: 'CLOSE_ADD_SUB' }),

      // balance detail
      openBalanceDetail: (listKey: string, id: string) => dispatch({ type: 'OPEN_BALANCE_DETAIL', listKey, id }),
      closeBalanceDetail: () => dispatch({ type: 'CLOSE_BALANCE_DETAIL' }),
      setBalanceDraftField: (field: keyof BalanceDraft, value: string) => dispatch({ type: 'SET_BALANCE_DRAFT_FIELD', field, value }),
      submitBalanceEntry: (listKey: string, id: string) => dispatch({ type: 'SUBMIT_BALANCE_ENTRY', listKey, id }),
      removeBalanceEntry: (listKey: string, id: string, entryId: string) => dispatch({ type: 'REMOVE_BALANCE_ENTRY', listKey, id, entryId }),

      toggleNwGroup: (key: string) => dispatch({ type: 'TOGGLE_NW_GROUP', key }),
      openInvestDetail: (listKey: string, id: string) => dispatch({ type: 'OPEN_INVEST_DETAIL', listKey, id }),
      closeInvestDetail: () => dispatch({ type: 'CLOSE_INVEST_DETAIL' }),
      setInvestDetailField: (listKey: string, id: string, field: string, value: string) => dispatch({ type: 'SET_INVEST_DETAIL_FIELD', listKey, id, field, value }),

      // swipe-to-confirm
      confirmSwipe: (id: string | number) => dispatch({ type: 'SWIPE_CONFIRM', id }),

      // review / import
      openReview: () => dispatch({ type: 'OPEN_REVIEW' }),
      closeReview: () => dispatch({ type: 'CLOSE_REVIEW' }),
      acceptCurrent: () => dispatch({ type: 'REVIEW_DECIDE', dir: 'accept' }),
      rejectCurrent: () => dispatch({ type: 'REVIEW_DECIDE', dir: 'reject' }),
      reviewDown: (clientX: number) => dispatch({ type: 'REVIEW_DOWN', clientX }),
      reviewMove: (clientX: number) => dispatch({ type: 'REVIEW_MOVE', clientX }),
      reviewUp: () => dispatch({ type: 'REVIEW_UP' }),
      uploadStatementFile: (file: File) => {
        dispatch({ type: 'SET_STATEMENT_UPLOADING', value: true });
        dispatch({ type: 'SET_STATEMENT_UPLOAD_ERROR', message: null });
        uploadStatement(file)
          .then(({ records }) => {
            const items: ReviewItem[] = records.map((r: ScannedStatementRecord) => ({
              id: 'stmt-' + uid(), merchant: r.vendor, amount: r.amount, cat: mapOcrCategory(r.category),
              dateLabel: r.date ? isoToDisplayDate(r.date) : 'Unknown date',
              brand: '', payment: 'Bank statement',
            }));
            dispatch({ type: 'SET_STATEMENT_UPLOADING', value: false });
            if (items.length === 0) {
              dispatch({ type: 'SET_STATEMENT_UPLOAD_ERROR', message: "Couldn't find any transactions in that file." });
              return;
            }
            dispatch({ type: 'ADD_PENDING_REVIEW_ITEMS', items });
            dispatch({ type: 'OPEN_REVIEW' });
          })
          .catch((err: Error) => {
            dispatch({ type: 'SET_STATEMENT_UPLOADING', value: false });
            dispatch({ type: 'SET_STATEMENT_UPLOAD_ERROR', message: err.message || 'Could not read that file.' });
          });
      },

      // scan / capture receipt
      openScan: () => dispatch({ type: 'OPEN_SCAN' }),
      closeScan: () => dispatch({ type: 'CLOSE_SCAN' }),
      chooseManual: () => dispatch({ type: 'CHOOSE_MANUAL' }),
      capturePhotoFile: (file: File) => {
        dispatch({ type: 'CAPTURE_PHOTO_START' });
        scanReceiptImage(file)
          .then((receipt) => dispatch({ type: 'CAPTURE_PHOTO_RESULT', receipt }))
          .catch((err: Error) => dispatch({ type: 'CAPTURE_PHOTO_FAILED', message: err.message }));
      },
      setScanMerchant: (value: string) => dispatch({ type: 'SET_SCAN_FIELD', field: 'scanMerchant', value }),
      setScanAmount: (value: string) => dispatch({ type: 'SET_SCAN_FIELD', field: 'scanAmount', value }),
      setScanDate: (value: string) => dispatch({ type: 'SET_SCAN_FIELD', field: 'scanDate', value }),
      setScanCategory: (value: string) => dispatch({ type: 'SET_SCAN_FIELD', field: 'scanCategory', value }),
      setScanDeductibleYes: () => dispatch({ type: 'SET_SCAN_DEDUCTIBLE', value: true }),
      setScanDeductibleNo: () => dispatch({ type: 'SET_SCAN_DEDUCTIBLE', value: false }),
      saveScan: () => dispatch({ type: 'SAVE_SCAN' }),
      scanAnother: () => dispatch({ type: 'SCAN_ANOTHER' }),
      viewInTax: () => dispatch({ type: 'VIEW_IN_TAX' }),

      // AI assistant
      toggleAiView: () => dispatch({ type: 'TOGGLE_AI_VIEW' }),
      startNewAiChat: () => dispatch({ type: 'START_NEW_AI_CHAT' }),
      openAiHistoryChat: (messages: AppState['aiMessages']) => dispatch({ type: 'OPEN_AI_HISTORY_CHAT', messages }),
      setAiInput: (value: string) => dispatch({ type: 'SET_AI_INPUT', value }),
      submitAiText: (text: string) => {
        const t = (text || '').trim();
        if (!t) return;
        dispatch({ type: 'SUBMIT_AI_TEXT_USER', text: t });
        // A minimum delay keeps the existing typing-indicator pacing even
        // when a real Gemini reply comes back fast; requestAiReply throwing
        // (network error, backend down) or returning source:"canned"
        // (no GEMINI_API_KEY configured, or the call itself failed) both
        // fall back to the same client-side canned reply — the chat must
        // never go silent or error out.
        const minDelay = new Promise((resolve) => setTimeout(resolve, 500));
        const history = state.aiMessages; // prior turns, before this user message is appended above
        const context = selectAiContext(state);
        Promise.all([requestAiReply(t, history, context).catch(() => null), minDelay])
          .then(([res]) => {
            const reply = res && res.source === 'gemini' && res.reply ? res.reply : aiCraftReply(t);
            dispatch({ type: 'SUBMIT_AI_TEXT_REPLY', text: reply });
          });
      },

      // accounts
      authSignup: async (email: string, password: string) => {
        const user = await apiSignup(email, password);
        dispatch({ type: 'SET_AUTH_USER', user });
        const remote = await fetchRemoteState();
        if (remote) dispatch({ type: 'APPLY_REMOTE_STATE', payload: remote });
      },
      authLogin: async (email: string, password: string) => {
        const user = await apiLogin(email, password);
        dispatch({ type: 'SET_AUTH_USER', user });
        const remote = await fetchRemoteState();
        if (remote) dispatch({ type: 'APPLY_REMOTE_STATE', payload: remote });
      },
      authLogout: () => {
        apiLogout();
        dispatch({ type: 'SET_AUTH_USER', user: null });
      },
      openAuthPanel: () => dispatch({ type: 'OPEN_AUTH_PANEL' }),
      closeAuthPanel: () => dispatch({ type: 'CLOSE_AUTH_PANEL' }),
      openLegal: (doc: 'privacy' | 'terms') => dispatch({ type: 'OPEN_LEGAL', doc }),
      closeLegal: () => dispatch({ type: 'CLOSE_LEGAL' }),
      requestPasswordReset: (email: string) => apiForgotPassword(email),
      completePasswordReset: async (newPassword: string) => {
        if (!state.resetToken) throw new Error('Missing reset token');
        await apiResetPassword(state.resetToken, newPassword);
        dispatch({ type: 'SET_RESET_TOKEN', token: null });
      },
      cancelPasswordReset: () => dispatch({ type: 'SET_RESET_TOKEN', token: null }),
      setUserMode: (mode: 'developer' | 'customer') => dispatch({ type: 'SET_USER_MODE', mode }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ob.linkedIds]);
}
