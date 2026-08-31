import { useStore, useActions } from '../../store/StoreProvider';
import { RELIEF_OPTS, EMPLOYMENT_OPTS } from '../../lib/constants';
import { ChipRow, OtherInput, singleOpts, multiOpts } from '../onboarding/steps/shared';

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

/** Content-only — a parent renders this inside a full BottomSheet gated on
 * state.taxProfileOpen. Edits the same ob.* fields the onboarding tax-setup
 * steps ('about' — which now folds in the old disability/housing-loan
 * questions — and 'txReliefs') collect, through the same
 * actions.setOb/toggleObArray dispatches, so there's exactly one place the
 * profile behind Tax Center's relief eligibility actually lives. */
export function TaxProfileModal() {
  const { state } = useStore();
  const actions = useActions();

  if (!state.taxProfileOpen) return null;
  const ob = state.ob;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 20px) 20px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          type="button"
          onClick={actions.closeTaxProfile}
          aria-label="Back"
          className="pressable"
          style={{ background: 'none', border: 'none', padding: 8, marginLeft: -8, cursor: 'pointer', color: 'var(--color-text)' }}
        >
          <BackIcon />
        </button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>Tax profile</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
        This personalises which LHDN relief categories Tax Center surfaces for you. Nothing here is final.
      </div>

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Tax residency</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {singleOpts(['Resident', 'Non-resident'], ob.residency, (label) => actions.setOb('residency', label)).map((opt) => (
          <button
            key={opt.label} type="button" onClick={opt.onClick} className="pressable"
            style={{ flex: 1, padding: 10, borderRadius: 'var(--radius-md)', cursor: 'pointer', font: '600 13px var(--font-body)', border: `1.5px solid ${opt.borderColor}`, background: opt.bg, color: opt.color }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Marital status</div>
      <ChipRow opts={singleOpts(['Single', 'Married', 'Divorced', 'Other'], ob.marital, (label) => actions.setOb('marital', label))} chipStyleOverride={{ padding: '9px 14px' }} style={{ marginBottom: 8 }} />
      {ob.marital === 'Other' && <OtherInput value={ob.otherText.marital || ''} onChange={(v) => actions.setObOther('marital', v)} style={{ marginBottom: 18 }} />}
      {ob.marital !== 'Other' && <div style={{ marginBottom: 18 }} />}

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Dependants</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {singleOpts(['0', '1', '2', '3', '4+'], ob.dependants, (label) => actions.setOb('dependants', label)).map((opt) => (
          <button
            key={opt.label} type="button" onClick={opt.onClick} className="pressable"
            style={{ width: 42, height: 42, borderRadius: '50%', cursor: 'pointer', font: '600 13px var(--font-body)', border: `1.5px solid ${opt.borderColor}`, background: opt.bg, color: opt.color }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Employment status</div>
      <ChipRow opts={singleOpts(EMPLOYMENT_OPTS, ob.employment, (label) => actions.setOb('employment', label))} chipStyleOverride={{ padding: '9px 14px' }} style={{ marginBottom: 16 }} />
      {ob.employment === 'Other' && <OtherInput value={ob.otherText.employment || ''} onChange={(v) => actions.setObOther('employment', v)} style={{ marginBottom: 16 }} />}

      <div className="field" style={{ marginBottom: 20 }}>
        <label>Employer / source of income (optional)</label>
        <input className="input" value={ob.employer} onChange={(e) => actions.setOb('employer', e.target.value)} placeholder="e.g. Petronas, or your business name" />
      </div>

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Do you or a dependant have a registered disability?</div>
      <ChipRow opts={singleOpts(['Yes', 'No'], ob.hasDisability, (label) => actions.setOb('hasDisability', label))} chipStyleOverride={{ padding: '9px 16px' }} style={{ marginBottom: 20 }} />

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Do you have a housing loan on your first home?</div>
      <ChipRow opts={singleOpts(['Yes', 'No'], ob.hasHousingLoan, (label) => actions.setOb('hasHousingLoan', label))} chipStyleOverride={{ padding: '9px 16px' }} style={{ marginBottom: ob.hasHousingLoan === 'Yes' ? 12 : 24 }} />
      {ob.hasHousingLoan === 'Yes' && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ font: '600 12px var(--font-body)', marginBottom: 6 }}>What was the home’s purchase price? (RM)</div>
          <input
            className="input"
            inputMode="numeric"
            value={ob.housingPrice}
            onChange={(e) => actions.setOb('housingPrice', e.target.value.replace(/[^\d]/g, ''))}
            placeholder="e.g. 480000"
          />
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.45 }}>
            Sets your housing-loan interest relief: up to RM7,000/year at RM500,000 or below, RM5,000/year from RM500,001–RM750,000, none above RM750,000.
          </div>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--color-divider)', marginBottom: 20 }} />
      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Which of these apply to you?</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>We use this to flag deductible spending automatically.</div>
      <ChipRow opts={multiOpts(RELIEF_OPTS, ob.reliefs, (label) => actions.toggleObArray('reliefs', label))} chipStyleOverride={{ padding: '10px 16px' }} style={{ marginBottom: 24 }} />
      {ob.reliefs.includes('Other') && <OtherInput value={ob.otherText.reliefs || ''} onChange={(v) => actions.setObOther('reliefs', v)} style={{ marginBottom: 24 }} />}

      <button type="button" onClick={actions.closeTaxProfile} className="btn btn-primary btn-lg">Done</button>
    </div>
  );
}
