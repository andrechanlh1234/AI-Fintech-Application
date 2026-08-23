import { useStore, useActions } from '../../store/StoreProvider';
import type { FinanceSection } from '../../store/types';
import { NetWorthSection } from './NetWorthSection';
import RecordSection from './RecordSection';
import StatsSection from './StatsSection';
import { BudgetsSection } from './BudgetsSection';

const SECTIONS: { key: FinanceSection; label: string }[] = [
  { key: 'networth', label: 'Net worth' },
  { key: 'record', label: 'Record' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'stats', label: 'Stats' },
];

export function FinanceTab() {
  const { state } = useStore();
  const actions = useActions();

  const goSection = (key: FinanceSection) => {
    if (key === 'networth') actions.goFinanceNetWorth();
    else if (key === 'record') actions.goFinanceTransactions();
    else if (key === 'budgets') actions.goFinanceBudgets();
    else actions.goFinanceStats();
  };

  const activeIdx = SECTIONS.findIndex((s) => s.key === state.financeSection);

  return (
    <div style={{ padding: '58px 16px 0', boxSizing: 'border-box' }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, marginBottom: 12 }}>Finance</div>
      <div className="tab-track" role="tablist" style={{ marginBottom: 8, width: '100%' }}>
        <div
          className="tab-indicator"
          style={{ left: `calc(3px + (100% - 6px)/${SECTIONS.length}*${activeIdx})`, width: `calc((100% - 6px)/${SECTIONS.length})` }}
        />
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={state.financeSection === s.key}
            onClick={() => goSection(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div key={state.financeSection} className="tab-panel-in">
        {state.financeSection === 'networth' && <NetWorthSection />}
        {state.financeSection === 'record' && <RecordSection />}
        {state.financeSection === 'budgets' && <BudgetsSection />}
        {state.financeSection === 'stats' && <StatsSection />}
      </div>
    </div>
  );
}
