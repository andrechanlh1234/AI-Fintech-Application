import { StoreProvider, useStore, useActions } from './store/StoreProvider';
import { TabBar } from './components/TabBar';
import { BottomSheet } from './components/BottomSheet';
import { OnboardingFlow } from './screens/onboarding/OnboardingFlow';
import { Home } from './screens/Home';
import { FinanceTab } from './screens/finance/FinanceTab';
import { TaxCenter } from './screens/tax/TaxCenter';
import { AiChat } from './screens/ai/AiChat';
import { ScanFlow } from './screens/modals/ScanFlow';
import { ReviewFlow } from './screens/modals/ReviewFlow';
import { MorePanel } from './screens/modals/MorePanel';
import { NotifPanel } from './screens/modals/NotifPanel';
import { BalanceDetailModal } from './screens/modals/BalanceDetailModal';
import { InvestDetailModal } from './screens/modals/InvestDetailModal';
import { BudgetItemDetailModal } from './screens/modals/BudgetItemDetailModal';
import { TaxItemDetailModal } from './screens/modals/TaxItemDetailModal';
import { TaxPackModal } from './screens/modals/TaxPackModal';
import { DonateModal } from './screens/modals/DonateModal';
import { AddSubModal } from './screens/modals/AddSubModal';
import { AuthPanel } from './screens/modals/AuthPanel';
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
  const showTabBar = !state.scanOpen && !state.reviewOpen && !state.morePanelOpen
    && !state.notifPanelOpen && !state.taxPackOpen && !state.budgetItemDetailOpen
    && !state.addSubOpen && !state.taxItemDetailOpen && !state.donateOpen
    && !state.statsCategoryDetail;

  return (
    <div data-theme={state.theme} style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 90, minHeight: '100vh', position: 'relative' }}>
        {state.tab === 'home' && <Home />}
        {state.tab === 'finance' && <FinanceTab />}
        {state.tab === 'tax' && <TaxCenter />}
        {state.tab === 'ai' && <AiChat />}

        {/* Self-positioned full-screen overlays (position:absolute;inset:0 within
            this relative container) — they self-gate on their own state flag. */}
        <ScanFlow />
        <ReviewFlow />
        <BudgetItemDetailModal />
        <TaxItemDetailModal />
        <TaxPackModal />
      </div>

      {showTabBar && (
        <TabBar active={state.tab} onSelect={(t) => {
          if (t === 'home') actions.goHome();
          else if (t === 'finance') actions.goFinance();
          else if (t === 'tax') actions.goTax();
          else actions.goAi();
        }} onScan={actions.openScan} />
      )}

      {/* Content-only panels — rendered inside the shared BottomSheet overlay. */}
      <BottomSheet open={state.morePanelOpen} onClose={actions.closeMorePanel}>
        <MorePanel />
      </BottomSheet>
      <BottomSheet open={state.notifPanelOpen} onClose={actions.closeNotifPanel}>
        <NotifPanel />
      </BottomSheet>
      <BottomSheet open={!!state.balanceDetailOpen} onClose={actions.closeBalanceDetail}>
        <BalanceDetailModal />
      </BottomSheet>
      <BottomSheet open={!!state.investDetailOpen} onClose={actions.closeInvestDetail}>
        <InvestDetailModal />
      </BottomSheet>
      <BottomSheet open={state.donateOpen} onClose={actions.closeDonate}>
        <DonateModal />
      </BottomSheet>
      <BottomSheet open={state.addSubOpen} onClose={actions.closeAddSub}>
        <AddSubModal />
      </BottomSheet>
      <BottomSheet open={state.authPanelOpen} onClose={actions.closeAuthPanel}>
        <AuthPanel />
      </BottomSheet>
      <BottomSheet open={!!state.legalOpen} onClose={actions.closeLegal}>
        {state.legalOpen && <LegalDoc doc={state.legalOpen} />}
      </BottomSheet>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}
