import { useEffect } from 'react';
import { StoreProvider, useStore, useActions } from './store/StoreProvider';
import { TabBar } from './components/TabBar';
import { BottomSheet } from './components/BottomSheet';
import { SwipeablePages } from './components/SwipeablePages';
import type { Tab } from './store/types';
import { OnboardingFlow } from './screens/onboarding/OnboardingFlow';
import { Home } from './screens/Home';
import { FinanceTab } from './screens/finance/FinanceTab';
import { TaxCenter } from './screens/tax/TaxCenter';
import { AiChat } from './screens/ai/AiChat';
import { ScanFlow } from './screens/modals/ScanFlow';
import { ReviewFlow } from './screens/modals/ReviewFlow';
import { StatementImportOverlay } from './screens/modals/StatementImportOverlay';
import { MorePanel } from './screens/modals/MorePanel';
import { NotifPanel } from './screens/modals/NotifPanel';
import { BalanceDetailModal } from './screens/modals/BalanceDetailModal';
import { TxDetailModal } from './screens/modals/TxDetailModal';
import { InvestDetailModal } from './screens/modals/InvestDetailModal';
import { HistoryScreen } from './screens/modals/HistoryScreen';
import { TaxReceiptsScreen } from './screens/tax/TaxReceiptsScreen';
import { BudgetItemDetailModal } from './screens/modals/BudgetItemDetailModal';
import { TaxItemDetailModal } from './screens/modals/TaxItemDetailModal';
import { TaxPackModal } from './screens/modals/TaxPackModal';
import { DonateModal } from './screens/modals/DonateModal';
import { AddSubModal } from './screens/modals/AddSubModal';
import { TaxProfileModal } from './screens/modals/TaxProfileModal';
import { AuthPanel } from './screens/modals/AuthPanel';
import { BudgetPromptSheet } from './screens/modals/BudgetPromptSheet';
import { LegalDoc } from './screens/legal/LegalDoc';

function AppShell() {
  const { state } = useStore();
  const actions = useActions();

  if (state.appStage === 'onboarding') {
    return <OnboardingFlow />;
  }

  // Ported from the source's `showMainApp` flag: the bottom tab bar hides
  // whenever a full-screen overlay is open, so it never overlaps that
  // overlay's own bottom action button.
  const TAB_KEYS: Tab[] = ['home', 'finance', 'tax', 'ai'];
  const TAB_ORDER: Record<string, number> = { home: 0, finance: 1, tax: 2, ai: 3 };

  const showTabBar = !state.scanOpen && !state.reviewOpen && !state.morePanelOpen
    && !state.notifPanelOpen && !state.taxPackOpen && !state.budgetItemDetailOpen
    && !state.addSubOpen && !state.taxItemDetailOpen && !state.donateOpen
    && !state.statsCategoryDetail && !state.statementUploading;

  const selectTab = (t: Tab) => {
    if (t === 'home') actions.goHome();
    else if (t === 'finance') actions.goFinance();
    else if (t === 'tax') actions.goTax();
    else actions.goAi();
  };

  const renderPage = (i: number, active: boolean) => {
    switch (TAB_KEYS[i]) {
      case 'home': return <Home />;
      case 'finance': return <FinanceTab />;
      case 'tax': return <TaxCenter />;
      case 'ai': return <AiChat active={active} />;
      default: return null;
    }
  };

  return (
    <div data-theme={state.theme} style={{ minHeight: '100dvh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 104, minHeight: '100dvh', position: 'relative' }}>
        <SwipeablePages
          index={TAB_ORDER[state.tab] ?? 0}
          count={TAB_KEYS.length}
          renderPage={renderPage}
          onIndexChange={(i) => selectTab(TAB_KEYS[i])}
          disabled={!showTabBar}
        />

        {/* Self-positioned full-screen overlays (position:absolute;inset:0 within
            this relative container) — they self-gate on their own state flag. */}
        <ScanFlow />
        <ReviewFlow />
        <StatementImportOverlay />
        <BudgetItemDetailModal />
        <TaxItemDetailModal />
        <TaxPackModal />
      </div>

      {showTabBar && (
        <TabBar active={state.tab} onSelect={selectTab} onScan={actions.openScan} />
      )}

      {/* Content-only panels — rendered inside the shared BottomSheet overlay. */}
      <BottomSheet open={state.morePanelOpen} onClose={actions.closeMorePanel}>
        <MorePanel />
      </BottomSheet>
      <BottomSheet open={state.notifPanelOpen} onClose={actions.closeNotifPanel}>
        <NotifPanel />
      </BottomSheet>
      <BottomSheet open={!!state.balanceDetailOpen} onClose={actions.closeBalanceDetail} align="full">
        <BalanceDetailModal />
      </BottomSheet>
      <BottomSheet open={!!state.investDetailOpen} onClose={actions.closeInvestDetail} align="full">
        <InvestDetailModal />
      </BottomSheet>
      <BottomSheet open={!!state.txDetailOpen} onClose={actions.closeTxDetail} align="full">
        <TxDetailModal />
      </BottomSheet>
      <BottomSheet open={!!state.historyOpen} onClose={actions.closeHistory} align="full">
        <HistoryScreen />
      </BottomSheet>
      <BottomSheet open={state.taxReceiptsOpen} onClose={actions.closeTaxReceipts} align="full">
        <TaxReceiptsScreen />
      </BottomSheet>
      <BottomSheet open={state.donateOpen} onClose={actions.closeDonate}>
        <DonateModal />
      </BottomSheet>
      <BottomSheet open={state.addSubOpen} onClose={actions.closeAddSub}>
        <AddSubModal />
      </BottomSheet>
      <BottomSheet open={state.taxProfileOpen} onClose={actions.closeTaxProfile} align="full">
        <TaxProfileModal />
      </BottomSheet>
      <BottomSheet open={state.authPanelOpen} onClose={actions.closeAuthPanel}>
        <AuthPanel />
      </BottomSheet>
      <BudgetPromptSheet />
      <BottomSheet open={!!state.legalOpen} onClose={actions.closeLegal}>
        {state.legalOpen && <LegalDoc doc={state.legalOpen} />}
      </BottomSheet>
    </div>
  );
}

/** Mirror the current theme onto <html> so portalled surfaces (BottomSheet,
 * dropdowns) — which live outside the themed shell div — read the live
 * `var(--color-*)` values off :root and recolour instantly on a theme
 * switch, even while a sheet is open (L7). */
function ThemeSync() {
  const { state } = useStore();
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [state.theme]);
  return null;
}

export default function App() {
  return (
    <StoreProvider>
      <ThemeSync />
      <AppShell />
    </StoreProvider>
  );
}
