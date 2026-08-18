import { useStore, useActions } from '../../store/StoreProvider';
import { Toggle } from '../../components/primitives';
import { selectSubscriptions } from '../../store/selectors';
import { subBadge } from '../../lib/constants';
import { money } from '../../lib/format';

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

const sectionLabelStyle = {
  font: '600 10.5px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase' as const,
  color: 'var(--color-text-muted)', margin: '20px 0 4px',
};

const rowButtonStyle = {
  all: 'unset' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '13px 0', borderBottom: '1px solid var(--color-neutral-300)', cursor: 'pointer',
  width: '100%', boxSizing: 'border-box' as const,
};

export function MorePanel() {
  const { state } = useStore();
  const actions = useActions();

  const ob = state.ob;
  const obInitials = ob.name
    ? ob.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('')
    : 'AN';
  const obDisplayName = ob.name || 'Aina Natasha';
  const obDisplayEmail = ob.name ? `${ob.name.split(' ')[0].toLowerCase()}@gmail.com` : 'aina.natasha@gmail.com';
  const obTaxProfileSummary = `${ob.residency || 'Resident'} · ${ob.marital || 'Single'} · ${state.taxYear}`;

  const isPremium = state.subscriptionTier === 'premium';
  const subscriptionTagClass = isPremium ? 'tag-accent' : 'tag-neutral';
  const subscriptionTagLabel = isPremium ? 'Premium' : 'Free';

  const settingsList = [
    { key: 'budgetAlerts' as const, label: 'Budget alerts', sub: 'Notify when a bucket is close to its limit' },
    { key: 'taxReminders' as const, label: 'Tax deadline reminders', sub: 'LHDN filing dates and relief updates' },
    { key: 'weeklySummary' as const, label: 'Weekly summary', sub: 'A short recap every Monday morning' },
  ].map((item) => ({ ...item, on: state.settingsToggles[item.key] }));

  const { subs } = selectSubscriptions(state);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 20px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17 }}>More</span>
        <button type="button" onClick={actions.closeMorePanel} aria-label="Close" className="pressable" style={{ background: 'none', border: 'none', padding: 8, marginRight: -8, cursor: 'pointer', color: 'var(--color-text)' }}>
          <CloseIcon />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-neutral-200)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
          {obInitials}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{obDisplayName}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{obDisplayEmail}</div>
        </div>
      </div>

      <div style={sectionLabelStyle}>Account</div>
      <div style={{ borderTop: '1px solid var(--color-divider)' }} />
      <button type="button" className="pressable" style={rowButtonStyle}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Linked accounts</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>6 accounts connected</div>
        </div>
        <ChevronIcon />
      </button>
      <button type="button" className="pressable" style={rowButtonStyle}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Tax profile</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{obTaxProfileSummary}</div>
        </div>
        <ChevronIcon />
      </button>
      <button type="button" onClick={actions.toggleSubscriptionTier} className="pressable" style={rowButtonStyle}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Subscription</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Tap to preview the other tier</div>
        </div>
        <span className={`tag ${subscriptionTagClass}`}>{subscriptionTagLabel}</span>
      </button>

      <div style={sectionLabelStyle}>Notifications</div>
      <div style={{ borderTop: '1px solid var(--color-divider)' }} />
      {settingsList.map((item) => (
        <div key={item.key} style={{ padding: '13px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{item.sub}</div>
            </div>
            <Toggle on={item.on} onToggle={() => actions.toggleSetting(item.key)} />
          </div>
        </div>
      ))}

      <div style={sectionLabelStyle}>Security &amp; support</div>
      <div style={{ borderTop: '1px solid var(--color-divider)' }} />
      <div style={{ padding: '13px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Appearance</div>
          <div className="seg" style={{ flexShrink: 0 }}>
            <label className="seg-opt">
              <input type="radio" name="theme" checked={state.theme === 'light'} onChange={actions.setThemeLight} />
              Light
            </label>
            <label className="seg-opt">
              <input type="radio" name="theme" checked={state.theme === 'dark'} onChange={actions.setThemeDark} />
              Dark
            </label>
          </div>
        </div>
      </div>
      <div style={{ padding: '13px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Face ID</div>
          <Toggle on={state.faceIdEnabled} onToggle={actions.toggleFaceId} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
          Falls back to your device passcode if Face ID is unavailable.
        </div>
      </div>
      <button type="button" className="pressable" style={rowButtonStyle}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>Help &amp; support</div>
        <ChevronIcon />
      </button>
      <button type="button" onClick={actions.openDonate} className="pressable" style={{ ...rowButtonStyle, borderBottom: 'none' }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Donate to Cukai</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>Support the app — totally optional</div>
        </div>
        <ChevronIcon />
      </button>

      <div style={sectionLabelStyle}>Manage subscriptions</div>
      <div style={{ borderTop: '1px solid var(--color-divider)' }} />
      {subs.length === 0 && (
        <div style={{ padding: '14px 0', fontSize: 12, color: 'var(--color-text-muted)' }}>No subscriptions added yet.</div>
      )}
      {subs.map((s, i) => {
        const b = subBadge(s.name);
        return (
          <div key={`${s.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: b.bg, color: b.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
              {b.letter}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{s.frequency} &middot; next {s.nextPayment || '—'}</div>
            </div>
            <div className="type-numeric" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>RM {money(parseFloat(s.amount) || 0)}</div>
            <button type="button" onClick={() => actions.removeSubscription(i)} aria-label="Remove" className="pressable" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
              <CloseIcon />
            </button>
          </div>
        );
      })}
      <button type="button" onClick={actions.openAddSub} className="pressable" style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent-700)', font: '700 12.5px var(--font-body)', padding: '10px 0 6px' }}>
        <PlusIcon />
        Add subscription
      </button>

      <div style={sectionLabelStyle}>Developer</div>
      <div style={{ borderTop: '1px solid var(--color-divider)' }} />
      <button type="button" onClick={actions.resetOnboarding} className="pressable" style={{ ...rowButtonStyle, borderBottom: 'none' }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Reset onboarding</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>Clears saved setup data and restarts from Step 1</div>
        </div>
        <ChevronIcon />
      </button>

      <button type="button" className="btn btn-ghost" style={{ marginTop: 26, color: 'var(--color-danger-700)' }}>Sign out</button>
    </div>
  );
}
