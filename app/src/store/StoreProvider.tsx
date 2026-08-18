import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { AppState, ManualData, BalanceDraft } from './types';
import { reducer, type Action } from './reducer';
import { buildInitialState, mergePersisted, persistState, clearPersisted } from './initialState';
import { aiCraftReply } from '../lib/seedData';

const StoreContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => mergePersisted(buildInitialState()));

  useEffect(() => {
    const t = setTimeout(() => dispatch({ type: 'SET_MOUNTED' }), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    persistState(state);
    // Persist whenever any user-editable slice of state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ob.manual, state.finance.buckets, state.appStage, state.theme, state.netWorthSeed]);

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
      addBucketCategory: (bucketKey: string) => dispatch({ type: 'ADD_BUCKET_CATEGORY', bucketKey }),
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
      addRecord: (listKey: ManualListKey) => dispatch({ type: 'ADD_RECORD', listKey }),
      setRecordField: (listKey: ManualListKey, id: string, field: 'name' | 'amount', value: string) => dispatch({ type: 'SET_RECORD_FIELD', listKey, id, field, value }),
      removeRecord: (listKey: ManualListKey, id: string) => dispatch({ type: 'REMOVE_RECORD', listKey, id }),
      setInvestField: (idx: number, field: 'name' | 'qty' | 'buy' | 'cur', value: string) => dispatch({ type: 'SET_INVEST_FIELD', idx, field, value }),

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

      // scan / capture receipt
      openScan: () => dispatch({ type: 'OPEN_SCAN' }),
      closeScan: () => dispatch({ type: 'CLOSE_SCAN' }),
      chooseManual: () => dispatch({ type: 'CHOOSE_MANUAL' }),
      capturePhoto: () => {
        dispatch({ type: 'CAPTURE_PHOTO_START' });
        setTimeout(() => dispatch({ type: 'CAPTURE_PHOTO_DONE' }), 1500);
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
        setTimeout(() => dispatch({ type: 'SUBMIT_AI_TEXT_REPLY', text: aiCraftReply(t) }), 700);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ob.linkedIds]);
}
