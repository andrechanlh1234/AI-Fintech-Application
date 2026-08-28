// Full onboarding flow ported from Cukai v7.dc.html lines 63-503 (obStep machine).
// Not wrapped in the app's tab shell — this owns its own full-page layout.
import { useStore, useActions } from '../../store/StoreProvider';
import {
  OB_ORDER, SOURCE_OPTS, RELIEF_OPTS, INCOME_TYPE_OPTS, INCOME_RANGE_OPTS, EMPLOYMENT_OPTS, GOAL_OPTS, COUNTRY_OPTIONS,
} from '../../lib/constants';
import { StepHeader, ChipRow, OtherInput, singleOpts, multiOpts, CheckIcon } from './steps/shared';
import { AuthForm } from '../../components/AuthForm';
import { googleLoginUrl } from '../../lib/api';
import { computeAge, sanitizeRaw } from '../../lib/format';
import { useState } from 'react';
import { LinkAccountsStep } from './steps/LinkAccountsStep';
import { ManualSetupStep } from './steps/ManualSetupStep';
import { SubscriptionsStep } from './steps/SubscriptionsStep';
import { BudgetSetupStep } from './steps/BudgetSetupStep';

function computeOrder(multipleIncome: string | null, setupMethod: string | null): string[] {
  return OB_ORDER.filter((k) => {
    if (k === 'txIncomeTypes') return multipleIncome === 'Yes';
    if (k === 'manualSetup') return setupMethod === 'manual';
    return true;
  });
}

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

  // `order` drives actual navigation (goNext/goBack/nextAfter) and includes
  // every step. The visible "Step X of N" counter excludes the final
  // "You're all set" screen, which doesn't show a counter of its own —
  // so every other step's denominator reflects the count a user actually
  // experiences as "steps to fill in," not the raw array length.
  const order = computeOrder(ob.multipleIncome, ob.setupMethod);
  const idx = order.indexOf(state.obStep);
  const visibleOrder = order.filter((k) => k !== 'txDone');
  const visibleIdx = visibleOrder.indexOf(state.obStep);
  const progress = `Step ${visibleIdx + 1} of ${visibleOrder.length}`;

  const goNext = () => {
    if (idx >= 0 && idx < order.length - 1) actions.obNext(order[idx + 1]);
    else actions.obFinish();
  };
  const goBack = () => {
    if (idx > 0) actions.obBack(order[idx - 1]);
  };
  const nextAfter = (current: string, overrides: { multipleIncome?: string | null; setupMethod?: string | null }) => {
    const ord = computeOrder(overrides.multipleIncome ?? ob.multipleIncome, overrides.setupMethod ?? ob.setupMethod);
    const i = ord.indexOf(current);
    return i >= 0 && i < ord.length - 1 ? ord[i + 1] : ord[ord.length - 1];
  };
  const chooseManual = () => actions.chooseManualMethod(nextAfter('linkAccounts', { setupMethod: 'manual' }));
  const chooseLink = () => actions.chooseLinkMethod(nextAfter('linkAccounts', { setupMethod: 'link' }));

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
                I agree to the <a href="#">Terms &amp; Conditions</a> and <a href="#">Privacy Policy</a>
              </span>
            </label>
            <button type="button" onClick={goNext} className="btn btn-primary btn-lg" disabled={!ob.agreedTerms}>Continue</button>
          </div>
        )}

        {state.obStep === 'about' && (
          <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHeader progress={progress} onBack={goBack} onSkip={goNext} />
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>Tell us about yourself</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>A few basics so we can personalise things.</div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Name</label>
              <input className="input" value={ob.name} onChange={(e) => actions.setOb('name', e.target.value)} placeholder="Aina Natasha" />
            </div>
            {/* Uneven split + explicit minWidth:0 on each column: WebKit renders
                <input type="date"> at a wide intrinsic size that a bare
                `flex: 1` won't shrink, so an even 50/50 left the date box
                overlapping Country. Date gets the larger share (it holds
                day/month/year plus the native picker icon); the wider gap
                keeps clear air between them. */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
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
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Occupation</label>
              <input className="input" value={ob.occupation} onChange={(e) => actions.setOb('occupation', e.target.value)} placeholder="e.g. Product designer" />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label>Monthly income</label>
              <select className="input" value={ob.income} onChange={(e) => actions.setOb('income', e.target.value)}>
                {INCOME_RANGE_OPTS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div style={{ borderTop: '1px solid var(--color-divider)', marginBottom: 20 }} />
            <div className="tag tag-tax" style={{ alignSelf: 'flex-start', marginBottom: 10 }}>Tax Setup</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>A bit about your tax situation</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>This personalises your Tax Center.</div>

            <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Tax residency</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
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

            <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Dependants</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
              {singleOpts(['0', '1', '2', '3', '4+'], ob.dependants, (label) => actions.setOb('dependants', label)).map((opt) => (
                <button
                  key={opt.label} type="button" onClick={opt.onClick} className="pressable"
                  style={{ width: 42, height: 42, borderRadius: '50%', cursor: 'pointer', font: '600 13px var(--font-body)', border: `1.5px solid ${opt.borderColor}`, background: opt.bg, color: opt.color }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--color-divider)', marginBottom: 20 }} />

            <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Employment status</div>
            <ChipRow opts={singleOpts(EMPLOYMENT_OPTS, ob.employment, (label) => actions.setOb('employment', label))} chipStyleOverride={{ padding: '9px 14px' }} style={{ marginBottom: 16 }} />
            {ob.employment === 'Other' && <OtherInput value={ob.otherText.employment || ''} onChange={(v) => actions.setObOther('employment', v)} style={{ marginBottom: 16 }} />}

            <div className="field" style={{ marginBottom: 18 }}>
              <label>Employer / source of income (optional)</label>
              <input className="input" value={ob.employer} onChange={(e) => actions.setOb('employer', e.target.value)} placeholder="e.g. Petronas, or your business name" />
            </div>

            <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Do you have income besides your salary?</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {singleOpts(['Yes', 'No'], ob.multipleIncome, (label) => actions.setOb('multipleIncome', label)).map((opt) => (
                <button
                  key={opt.label} type="button" onClick={opt.onClick} className="pressable"
                  style={{ flex: 1, padding: 10, borderRadius: 'var(--radius-md)', cursor: 'pointer', font: '600 13px var(--font-body)', border: `1.5px solid ${opt.borderColor}`, background: opt.bg, color: opt.color }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={goNext} className="btn btn-primary btn-lg">Continue</button>
          </div>
        )}

        {state.obStep === 'txIncomeTypes' && (
          <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHeader progress={progress} onBack={goBack} onSkip={goNext} />
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>What other income do you have?</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>Select all that apply.</div>
            <ChipRow opts={multiOpts(INCOME_TYPE_OPTS, ob.incomeTypes, (label) => actions.toggleObArray('incomeTypes', label))} chipStyleOverride={{ padding: '10px 16px' }} />
            {ob.incomeTypes.includes('Other') && <OtherInput value={ob.otherText.incomeTypes || ''} onChange={(v) => actions.setObOther('incomeTypes', v)} style={{ marginTop: 12 }} />}
            <div style={{ flex: 1 }} />
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

        {state.obStep === 'txHealth' && (
          <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHeader progress={progress} onBack={goBack} onSkip={goNext} />
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>A couple more things</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
              This helps us personalise which tax categories we surface for you — we'll skip anything that doesn't apply.
            </div>
            <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Do you or a dependant have a registered disability?</div>
            <ChipRow opts={singleOpts(['Yes', 'No'], ob.hasDisability, (label) => actions.setOb('hasDisability', label))} chipStyleOverride={{ padding: '9px 16px' }} style={{ marginBottom: 20 }} />
            <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Do you have a housing loan on your first home?</div>
            <ChipRow opts={singleOpts(['Yes', 'No'], ob.hasHousingLoan, (label) => actions.setOb('hasHousingLoan', label))} chipStyleOverride={{ padding: '9px 16px' }} />
            <div style={{ flex: 1 }} />
            <button type="button" onClick={goNext} className="btn btn-primary btn-lg">Continue</button>
          </div>
        )}

        {state.obStep === 'goals' && (
          <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHeader progress={progress} onBack={goBack} onSkip={goNext} />
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>What are your goals?</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>Select all that apply — this helps us set up your budget.</div>
            <ChipRow opts={multiOpts(GOAL_OPTS, ob.goals, (label) => actions.toggleObArray('goals', label))} chipStyleOverride={{ padding: '10px 16px' }} style={{ marginBottom: 20 }} />
            <div className="field" style={{ marginBottom: 18 }}>
              <label>Monthly savings target (optional)</label>
              <input className="input" inputMode="decimal" value={ob.savingsTarget} onChange={(e) => actions.setOb('savingsTarget', sanitizeRaw(e.target.value))} placeholder="e.g. 1000" />
            </div>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={goNext} className="btn btn-primary btn-lg">Continue</button>
          </div>
        )}

        {state.obStep === 'budget' && (
          <BudgetSetupStep state={state} actions={actions} progress={progress} onBack={goBack} onSkip={goNext} onContinue={goNext} />
        )}

        {state.obStep === 'linkAccounts' && (
          <LinkAccountsStep state={state} actions={actions} progress={progress} onBack={goBack} onSkip={goNext} onChooseManual={chooseManual} onChooseLink={chooseLink} />
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
