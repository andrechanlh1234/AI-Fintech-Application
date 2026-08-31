// Full onboarding flow ported from Cukai v7.dc.html lines 63-503 (obStep machine).
// Not wrapped in the app's tab shell — this owns its own full-page layout.
import { useStore, useActions } from '../../store/StoreProvider';
import {
  OB_ORDER, SOURCE_OPTS, RELIEF_OPTS, INCOME_TYPE_OPTS, INCOME_RANGE_OPTS, EMPLOYMENT_OPTS,
  PRIMARY_GOAL_OPTS, GOAL_FOLLOWUP, COUNTRY_OPTIONS,
} from '../../lib/constants';
import { StepHeader, ChipRow, OtherInput, singleOpts, multiOpts, CheckIcon } from './steps/shared';
import { AuthForm } from '../../components/AuthForm';
import { googleLoginUrl } from '../../lib/api';
import { computeAge } from '../../lib/format';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { ManualSetupStep } from './steps/ManualSetupStep';
import { SubscriptionsStep } from './steps/SubscriptionsStep';
import { BudgetSetupStep } from './steps/BudgetSetupStep';

// Small ink-on-border section title used inside the one-page `about` step.
function SubTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, margin: '0 0 4px' }}>{children}</div>;
}

// Grey helper line under a control.
function Helper({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.45 }}>{children}</div>;
}

// Small bold label above a control (matches the existing inline pattern used
// throughout this step).
function MiniLabel({ children }: { children: ReactNode }) {
  return <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>{children}</div>;
}

// Full-width segmented control (Resident/Non-resident, Yes/No, 3/6/12) — the
// same button styling the residency toggle already used, factored out so the
// several new reveals in `about` and `goals` share it.
function Segmented({ opts, value, onSelect }: { opts: string[]; value: string | null; onSelect: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {singleOpts(opts, value, onSelect).map((opt) => (
        <button
          key={opt.label} type="button" onClick={opt.onClick} className="pressable"
          style={{ flex: 1, padding: 10, borderRadius: 'var(--radius-md)', cursor: 'pointer', font: '600 13px var(--font-body)', border: `1.5px solid ${opt.borderColor}`, background: opt.bg, color: opt.color }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const RULE: CSSProperties = { borderTop: '1px solid var(--color-divider)', margin: '22px 0' };
const MINOR_RULE: CSSProperties = { borderTop: '1px solid var(--color-divider)', opacity: 0.6, margin: '18px 0' };

export function OnboardingFlow() {
  const { state } = useStore();
  const actions = useActions();
  const ob = state.ob;
  const [oauthNote, setOauthNote] = useState<string | null>(() => {
    const err = new URLSearchParams(window.location.search).get('oauth_error');
    if (!err) return null;
    window.history.replaceState({}, '', window.location.pathname);
    return err === 'not_configured'
      ? 'Google sign-in isn’t configured on this server yet — use email for now.'
      : 'Google sign-in didn’t go through — use email for now, or try again.';
  });

  // `order` drives actual navigation (goNext/goBack). There are no longer any
  // conditional steps — the old `txIncomeTypes`/`txHealth` reveals now live
  // inline inside `about` — so it's just OB_ORDER. The visible "Step X of N"
  // counter excludes the final "You're all set" screen, which doesn't show a
  // counter of its own.
  const order = OB_ORDER;
  const idx = order.indexOf(state.obStep);
  const visibleOrder = order.filter((k) => k !== 'txDone');
  const visibleIdx = visibleOrder.indexOf(state.obStep);
  const totalSteps = OB_ORDER.filter((k) => k !== 'txDone').length;
  const progress = `Step ${visibleIdx + 1} of ${totalSteps}`;

  const goNext = () => {
    if (idx >= 0 && idx < order.length - 1) actions.obNext(order[idx + 1]);
    else actions.obFinish();
  };
  const goBack = () => {
    if (idx > 0) actions.obBack(order[idx - 1]);
  };

  // Primary money goal is single-select. Re-tapping the current one clears it.
  // Any change wipes the goal-specific follow-up (ob.goalDetail) and the
  // derived ob.savingsTarget, and drops the goal from the muted "anything
  // else?" multi-select if it was there.
  const pickPrimaryGoal = (label: string) => {
    const next = ob.primaryGoal === label ? null : label;
    actions.setOb('primaryGoal', next);
    actions.setObGoalDetail(null);
    if (next && ob.goals.includes(next)) actions.toggleObArray('goals', next);
  };

  const hasReliefProfile = ob.reliefs.length > 0;
  const obDoneSubtitle = hasReliefProfile
    ? `Your Tax Center is personalised for ${ob.reliefs.length} relief ${ob.reliefs.length === 1 ? 'category' : 'categories'}.`
    : 'Your Tax Center is ready — you can refine this anytime.';

  return (
    <div data-theme={state.theme} style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 24px) 22px 32px', boxSizing: 'border-box' }}>

        {state.obStep === 'login' && state.userMode === null && (
          <div className="screen-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 8 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" style={{ marginBottom: 6 }}>
              <path d="M20 4C10 4 4 10 4 20c8 0 16-6 16-16Z" fill="var(--color-accent)" />
              <path d="M6 18C10 14 14 10 19 5" stroke="var(--color-accent)" strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.5} />
            </svg>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, marginBottom: 6 }}>Are you a developer or a customer?</div>
            <div style={{ fontSize: 13.5, color: 'var(--color-text-muted)', maxWidth: '30ch', lineHeight: 1.5, marginBottom: 28 }}>
              Developer mode unlocks a Skip link through onboarding for faster testing. You can change this later in More &gt; Settings.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
              <button
                type="button" onClick={() => actions.setUserMode('customer')} className="btn btn-primary btn-lg"
              >
                I'm a customer
              </button>
              <button
                type="button" onClick={() => actions.setUserMode('developer')} className="pressable"
                style={{ width: '100%', padding: 15, background: 'none', border: '1.5px solid var(--color-neutral-400)', borderRadius: 'var(--radius-md)', font: '600 14px var(--font-body)', cursor: 'pointer', color: 'var(--color-text)', boxSizing: 'border-box' }}
              >
                I'm a developer
              </button>
            </div>
          </div>
        )}

        {state.obStep === 'login' && state.userMode !== null && (
          <div className="screen-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 8 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" style={{ marginBottom: 6 }}>
              <path d="M20 4C10 4 4 10 4 20c8 0 16-6 16-16Z" fill="var(--color-accent)" />
              <path d="M6 18C10 14 14 10 19 5" stroke="var(--color-accent)" strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.5} />
            </svg>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26 }}>Welcome to Cukai</div>
            <div style={{ fontSize: 13.5, color: 'var(--color-text-muted)', maxWidth: '28ch', lineHeight: 1.5, marginBottom: 28 }}>
              Your personal financial operating system — with an intelligent tax assistant built in.
            </div>
            <AuthForm onSuccess={goNext} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', margin: '14px 0 6px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--color-neutral-300)' }} />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-neutral-300)' }} />
            </div>

            <button
              type="button" onClick={() => { window.location.href = googleLoginUrl(); }} className="pressable"
              style={{ width: '100%', padding: 15, background: '#fff', border: '1.5px solid var(--color-neutral-400)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, font: '600 14px var(--font-body)', cursor: 'pointer', marginBottom: 10, boxSizing: 'border-box' }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.67-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.98 10.98 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.19V7.06H2.18a11 11 0 0 0 0 9.87l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a10.98 10.98 0 0 0-9.82 6.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google
            </button>
            <button
              type="button" onClick={() => setOauthNote('Apple sign-in needs a paid developer account we haven’t set up yet — use email for now.')} className="pressable"
              style={{ width: '100%', padding: 15, background: '#000', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, font: '600 14px var(--font-body)', cursor: 'pointer', boxSizing: 'border-box' }}
            >
              <svg width="15" height="17" viewBox="0 0 17 20" fill="#fff">
                <path d="M14.1 10.6c0-1.6.8-2.8 2.4-3.7-1-1.3-2.5-2-4.3-2.1-1.7-.1-3.2.9-4 .9-.9 0-2.2-.9-3.6-.9C2 4.9.3 6.7.3 9.6c0 1.5.3 3.1 1 4.6.9 2 2.6 5 4.5 4.9 1 0 1.7-.6 2.9-.6 1.2 0 1.8.6 2.9.6 1.9 0 3.5-2.7 4.4-4.7-2.6-1.3-3-1-2.9-3.8zM11 2.9c.8-1 1.4-2.3 1.2-3.6-1.2.1-2.6.9-3.4 1.9-.7.9-1.4 2.2-1.2 3.5 1.3.1 2.6-.7 3.4-1.8z" />
              </svg>
              Continue with Apple
            </button>
            {oauthNote && (
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', maxWidth: '30ch' }}>{oauthNote}</div>
            )}
            <button
              type="button" onClick={goNext} className="pressable"
              style={{ background: 'none', border: 'none', padding: 8, marginTop: 14, font: '600 13px var(--font-body)', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              Skip for now — use this device only
            </button>
          </div>
        )}

        {state.obStep === 'source' && (
          <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHeader progress={progress} onBack={goBack} onSkip={goNext} />
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>How did you hear about us?</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 22 }}>Just curious — helps us know what's working.</div>
            <ChipRow opts={singleOpts(SOURCE_OPTS, ob.source, (label) => actions.setOb('source', label))} chipStyleOverride={{ padding: '10px 16px' }} />
            {ob.source === 'Other' && <OtherInput value={ob.otherText.source || ''} onChange={(v) => actions.setObOther('source', v)} style={{ marginTop: 12 }} />}
            <div style={{ flex: 1 }} />
            <button type="button" onClick={goNext} className="btn btn-primary btn-lg">Continue</button>
          </div>
        )}

        {state.obStep === 'privacy' && (
          <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHeader progress={progress} onBack={goBack} onSkip={goNext} />
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--color-neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 20 }}>Your data stays private</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                  <rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>Bank-level 256-bit encryption on everything you connect and scan.</div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>We never sell your financial data to advertisers. Ever.</div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                  <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                </svg>
                <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>You can disconnect any account, anytime, in one tap.</div>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
              <input
                type="checkbox" checked={ob.agreedTerms} onChange={actions.toggleAgreedTerms}
                style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }}
              />
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
                I agree to the{' '}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); actions.openLegal('terms'); }}
                  style={{ all: 'unset', cursor: 'pointer', color: 'var(--color-accent-700)', fontWeight: 600 }}
                >
                  Terms &amp; Conditions
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); actions.openLegal('privacy'); }}
                  style={{ all: 'unset', cursor: 'pointer', color: 'var(--color-accent-700)', fontWeight: 600 }}
                >
                  Privacy Policy
                </button>
              </span>
            </label>
            <button type="button" onClick={goNext} className="btn btn-primary btn-lg" disabled={!ob.agreedTerms}>Continue</button>
          </div>
        )}

        {state.obStep === 'about' && (
          <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHeader progress={progress} onBack={goBack} onSkip={goNext} />
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>Tell us about you</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>This builds your tax profile and the reliefs you can claim. About a minute.</div>

            {/* ---- Section 1 — Personal ---- */}
            <SubTitle>Personal</SubTitle>
            <div className="field" style={{ marginTop: 12, marginBottom: 12 }}>
              <label>Full name</label>
              <input className="input" value={ob.name} onChange={(e) => actions.setOb('name', e.target.value)} placeholder="Nurul Aisyah binti Ahmad" />
            </div>
            {/* Uneven split + explicit minWidth:0 on each column: WebKit renders
                <input type="date"> at a wide intrinsic size that a bare
                `flex: 1` won't shrink, so an even 50/50 left the date box
                overlapping Country. Date gets the larger share (it holds
                day/month/year plus the native picker icon); the wider gap
                keeps clear air between them. */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 4 }}>
              <div className="field" style={{ flex: 5, minWidth: 0 }}>
                <label>Date of birth</label>
                <input type="date" className="input" value={ob.dob} onChange={(e) => actions.setOb('dob', e.target.value)} />
                {ob.dob && computeAge(ob.dob) !== null && (
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 4 }}>{computeAge(ob.dob)} years old</div>
                )}
              </div>
              <div className="field" style={{ flex: 4, minWidth: 0 }}>
                <label>Country</label>
                <select className="input" value={ob.country} onChange={(e) => actions.setOb('country', e.target.value)}>
                  {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={RULE} />

            {/* ---- Section 2 — Work & income ---- */}
            <div className="tag tag-tax" style={{ alignSelf: 'flex-start', marginBottom: 10 }}>Work</div>
            <SubTitle>What you do</SubTitle>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, marginBottom: 16 }}>
              <div className="field" style={{ flex: 1, minWidth: 0 }}>
                <label>Occupation</label>
                <input className="input" value={ob.occupation} onChange={(e) => actions.setOb('occupation', e.target.value)} placeholder="e.g. Product designer" />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 0 }}>
                <label>Income source</label>
                <input className="input" value={ob.employer} onChange={(e) => actions.setOb('employer', e.target.value)} placeholder="e.g. Petronas, or your business name" />
              </div>
            </div>

            <MiniLabel>Employment status</MiniLabel>
            <ChipRow opts={singleOpts(EMPLOYMENT_OPTS, ob.employment, (label) => actions.setOb('employment', label))} chipStyleOverride={{ padding: '9px 14px' }} style={{ marginBottom: 12 }} />
            {ob.employment === 'Other' && <OtherInput value={ob.otherText.employment || ''} onChange={(v) => actions.setObOther('employment', v)} style={{ marginBottom: 16 }} />}

            <div className="field" style={{ marginTop: 4 }}>
              <label>Monthly income</label>
              <select className="input" value={ob.income} onChange={(e) => actions.setOb('income', e.target.value)}>
                {INCOME_RANGE_OPTS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div style={RULE} />

            {/* ---- Section 3 — Your tax situation ---- */}
            <div className="tag tag-tax" style={{ alignSelf: 'flex-start', marginBottom: 10 }}>Tax Setup</div>
            <SubTitle>Your tax situation</SubTitle>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '6px 0 18px' }}>We use this to match you to the right residency rules, rebates and reliefs.</div>

            <MiniLabel>Tax residency</MiniLabel>
            <Segmented opts={['Resident', 'Non-resident']} value={ob.residency} onSelect={(label) => actions.setOb('residency', label)} />
            <Helper>You're usually a tax resident if you're in Malaysia 182 days or more a year.</Helper>

            <div style={{ marginTop: 18 }}>
              <MiniLabel>Marital status</MiniLabel>
              <ChipRow opts={singleOpts(['Single', 'Married', 'Divorced', 'Other'], ob.marital, (label) => actions.setOb('marital', label))} chipStyleOverride={{ padding: '9px 14px' }} style={{ marginBottom: 8 }} />
              {ob.marital === 'Other' && <OtherInput value={ob.otherText.marital || ''} onChange={(v) => actions.setObOther('marital', v)} style={{ marginBottom: 8 }} />}
            </div>

            <div style={{ marginTop: 18 }}>
              <MiniLabel>Children or dependants</MiniLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {singleOpts(['0', '1', '2', '3', '4+'], ob.dependants, (label) => actions.setOb('dependants', label)).map((opt) => (
                  <button
                    key={opt.label} type="button" onClick={opt.onClick} className="pressable"
                    style={{ width: 42, height: 42, borderRadius: '50%', cursor: 'pointer', font: '600 13px var(--font-body)', border: `1.5px solid ${opt.borderColor}`, background: opt.bg, color: opt.color }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={MINOR_RULE} />

            <MiniLabel>Do you earn money outside your main job?</MiniLabel>
            <Segmented opts={['Yes', 'No']} value={ob.multipleIncome} onSelect={(label) => actions.setOb('multipleIncome', label)} />
            <Helper>Your main job is what you entered above. This is about extra income — side gigs, rent, dividends — which is taxed differently and has its own reliefs.</Helper>
            {ob.multipleIncome === 'Yes' && (
              <div style={{ marginTop: 14 }}>
                <MiniLabel>Which kinds?</MiniLabel>
                <ChipRow opts={multiOpts(INCOME_TYPE_OPTS, ob.incomeTypes, (label) => actions.toggleObArray('incomeTypes', label))} chipStyleOverride={{ padding: '9px 14px' }} />
                {ob.incomeTypes.includes('Other') && <OtherInput value={ob.otherText.incomeTypes || ''} onChange={(v) => actions.setObOther('incomeTypes', v)} style={{ marginTop: 10 }} />}
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <MiniLabel>Do you or a dependant have an OKU-registered disability?</MiniLabel>
              <Segmented opts={['Yes', 'No']} value={ob.hasDisability} onSelect={(label) => actions.setOb('hasDisability', label)} />
              <Helper>Unlocks the disabled-individual and disabled-dependant reliefs.</Helper>
            </div>

            <div style={{ marginTop: 18 }}>
              <MiniLabel>Do you have a housing loan on your first home?</MiniLabel>
              <Segmented opts={['Yes', 'No']} value={ob.hasHousingLoan} onSelect={(label) => actions.setOb('hasHousingLoan', label)} />
              {ob.hasHousingLoan === 'Yes' && (
                <div style={{ marginTop: 12 }}>
                  <div className="field">
                    <label>Home price</label>
                    <input
                      className="input" inputMode="numeric" value={ob.housingPrice}
                      onChange={(e) => actions.setOb('housingPrice', e.target.value.replace(/[^\d]/g, ''))} placeholder="e.g. 480000"
                    />
                  </div>
                  <Helper>Sets which housing-loan interest relief tier you fall into.</Helper>
                </div>
              )}
            </div>

            <div style={{ flex: 1, minHeight: 24 }} />
            <button type="button" onClick={goNext} className="btn btn-primary btn-lg">Continue</button>
          </div>
        )}

        {state.obStep === 'txReliefs' && (
          <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHeader progress={progress} onBack={goBack} onSkip={goNext} />
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>Which of these apply to you?</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>We'll use this to flag deductible spending automatically. Nothing here is final.</div>
            <ChipRow opts={multiOpts(RELIEF_OPTS, ob.reliefs, (label) => actions.toggleObArray('reliefs', label))} chipStyleOverride={{ padding: '10px 16px' }} />
            {ob.reliefs.includes('Other') && <OtherInput value={ob.otherText.reliefs || ''} onChange={(v) => actions.setObOther('reliefs', v)} style={{ marginTop: 12 }} />}
            <div style={{ flex: 1 }} />
            <button type="button" onClick={goNext} className="btn btn-primary btn-lg">Continue</button>
          </div>
        )}

        {state.obStep === 'goals' && (
          <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHeader progress={progress} onBack={goBack} onSkip={goNext} />
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>What's your main money goal?</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>Pick the one that matters most right now. Cukai shapes your budget and nudges around it.</div>

            <ChipRow opts={singleOpts(PRIMARY_GOAL_OPTS, ob.primaryGoal, pickPrimaryGoal)} chipStyleOverride={{ padding: '10px 16px' }} />

            {ob.primaryGoal && (GOAL_FOLLOWUP[ob.primaryGoal]?.fields.length ?? 0) > 0 && (
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {GOAL_FOLLOWUP[ob.primaryGoal].fields.map((f) => {
                  const val = ob.goalDetail[f.key] ?? '';
                  const label = f.optional ? `${f.label} (optional)` : f.label;
                  if (f.kind === 'segmented') {
                    return (
                      <div key={f.key}>
                        <MiniLabel>{label}</MiniLabel>
                        <Segmented opts={f.options ?? []} value={val || null} onSelect={(v) => actions.setObGoalDetail(f.key, v)} />
                      </div>
                    );
                  }
                  if (f.kind === 'select') {
                    return (
                      <div key={f.key} className="field">
                        <label>{label}</label>
                        <select className="input" value={val} onChange={(e) => actions.setObGoalDetail(f.key, e.target.value)}>
                          <option value="" disabled>Choose…</option>
                          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    );
                  }
                  return (
                    <div key={f.key} className="field">
                      <label>{label}</label>
                      <input
                        className="input"
                        inputMode={f.kind === 'number' ? 'numeric' : undefined}
                        value={val}
                        onChange={(e) => actions.setObGoalDetail(f.key, f.kind === 'number' ? e.target.value.replace(/[^\d]/g, '') : e.target.value)}
                        placeholder={f.placeholder}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 26 }}>
              <div style={{ font: '600 12px var(--font-body)', color: 'var(--color-text-muted)', marginBottom: 8 }}>Working on anything else?</div>
              <ChipRow
                opts={multiOpts(
                  PRIMARY_GOAL_OPTS.filter((g) => g !== ob.primaryGoal),
                  ob.goals,
                  (label) => actions.toggleObArray('goals', label),
                )}
                chipStyleOverride={{ padding: '7px 12px', fontSize: 12, opacity: 0.9 }}
              />
            </div>

            <div style={{ flex: 1, minHeight: 24 }} />
            <button type="button" onClick={goNext} className="btn btn-primary btn-lg">Continue</button>
          </div>
        )}

        {state.obStep === 'budget' && (
          <BudgetSetupStep state={state} actions={actions} progress={progress} onBack={goBack} onSkip={goNext} onContinue={goNext} />
        )}

        {state.obStep === 'manualSetup' && (
          <ManualSetupStep state={state} actions={actions} progress={progress} onBack={goBack} onSkip={goNext} onContinue={goNext} />
        )}

        {state.obStep === 'subscriptions' && (
          <SubscriptionsStep state={state} actions={actions} progress={progress} onBack={goBack} onSkip={goNext} onContinue={goNext} />
        )}

        {state.obStep === 'txDone' && (
          <div className="screen-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div className="pop-in" style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <CheckIcon size={34} />
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, marginBottom: 8 }}>You're all set</div>
            <div style={{ fontSize: 13.5, color: 'var(--color-text-muted)', maxWidth: '26ch', lineHeight: 1.5, marginBottom: 30 }}>{obDoneSubtitle}</div>
            <button type="button" onClick={actions.obFinish} className="btn btn-primary btn-lg" style={{ width: '100%' }}>Go to Home</button>
          </div>
        )}

      </div>
    </div>
  );
}
