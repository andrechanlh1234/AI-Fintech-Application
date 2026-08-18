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

  return (
    <div>
      <div style={{ padding: '58px 16px 0' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, marginBottom: 12 }}>Finance</div>
        <div className="seg" style={{ marginBottom: 8, width: '100%' }}>
          {SECTIONS.map((s) => (
            <label key={s.key} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" name="financeSection" checked={state.financeSection === s.key} onChange={() => goSection(s.key)} />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      {state.financeSection === 'networth' && <NetWorthSection />}
      {state.financeSection === 'record' && <RecordSection />}
      {state.financeSection === 'budgets' && <BudgetsSection />}
      {state.financeSection === 'stats' && <StatsSection />}
    </div>
  );
}
