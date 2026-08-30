import { useState } from 'react';
import { useActions } from '../store/StoreProvider';
import { KeypadField } from './AmountKeypadSheet';

/** Guided add-category flow shared by onboarding's BudgetSetupStep and the
 * post-onboarding Budgets screen: pick a name first (a dropdown of common
 * names for this bucket, or "Other" for a custom one), then the monthly
 * cap input appears — as the last step before confirming, not both fields
 * dumped on screen at once. `initialName` (from tapping a quick-add chip)
 * skips straight to the cap step. */
export function AddBudgetCategoryForm({
  bucketKey, commonNames, existingNames, initialName, onDone,
}: {
  bucketKey: string;
  commonNames: string[];
  existingNames: string[];
  initialName?: string;
  onDone: () => void;
}) {
  const actions = useActions();
  const available = commonNames.filter((n) => !existingNames.includes(n));
  const [phase, setPhase] = useState<'chooseName' | 'setCap'>(initialName ? 'setCap' : 'chooseName');
  const [dropdownValue, setDropdownValue] = useState<string>(available[0] ?? 'Other');
  const [customName, setCustomName] = useState('');
  const [chosenName, setChosenName] = useState(initialName ?? '');
  const [cap, setCap] = useState('');

  const confirmName = () => {
    const name = dropdownValue === 'Other' ? customName.trim() : dropdownValue;
    if (!name) return;
    setChosenName(name);
    setPhase('setCap');
  };

  const submitCap = () => {
    actions.addBucketCategory(bucketKey, chosenName, false, parseFloat(cap) || 0);
    onDone();
  };

  if (phase === 'setCap') {
    return (
      <div className="card" style={{ flexDirection: 'column', gap: 10, padding: '12px', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{chosenName}</div>
        <KeypadField value={cap} onSave={setCap} placeholder="Monthly cap (RM)" />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onDone} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          <button type="button" onClick={submitCap} className="btn btn-primary" style={{ flex: 1 }}>Add</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ flexDirection: 'column', gap: 10, padding: '12px', marginBottom: 8 }}>
      <select className="input" value={dropdownValue} onChange={(e) => setDropdownValue(e.target.value)}>
        {available.map((n) => <option key={n} value={n}>{n}</option>)}
        <option value="Other">Other…</option>
      </select>
      {dropdownValue === 'Other' && (
        <input
          className="input" autoFocus value={customName} onChange={(e) => setCustomName(e.target.value)}
          placeholder="Category name"
        />
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onDone} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
        <button
          type="button" onClick={confirmName} className="btn btn-primary" style={{ flex: 1 }}
          disabled={dropdownValue === 'Other' && !customName.trim()}
        >
          Next
        </button>
      </div>
    </div>
  );
}
