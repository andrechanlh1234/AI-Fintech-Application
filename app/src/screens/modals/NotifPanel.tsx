import { useActions } from '../../store/StoreProvider';
import { NOTIFICATIONS, notifIconFlags } from '../../lib/seedData';

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function NotifIcon({ kind }: { kind: string }) {
  const svgProps = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (kind === 'tax') {
    return (
      <svg {...svgProps}>
        <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
      </svg>
    );
  }
  if (kind === 'mail') {
    return (
      <svg {...svgProps}>
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    );
  }
  if (kind === 'trend') {
    return (
      <svg {...svgProps}>
        <path d="M7 17 17 7" />
        <path d="M7 7h10v10" />
      </svg>
    );
  }
  if (kind === 'check') {
    return (
      <svg {...svgProps}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  // budget
  return (
    <svg {...svgProps}>
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M16 12h.01" />
      <path d="M2 10h20" />
    </svg>
  );
}

export function NotifPanel() {
  const actions = useActions();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 20px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17 }}>Notifications</span>
        <button type="button" onClick={actions.closeNotifPanel} aria-label="Close" className="pressable" style={{ background: 'none', border: 'none', padding: 8, marginRight: -8, cursor: 'pointer', color: 'var(--color-text)' }}>
          <CloseIcon />
        </button>
      </div>
      {NOTIFICATIONS.length === 0 && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>You're all caught up</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5 }}>
            Budget, tax and account alerts will show up here as they happen.
          </div>
        </div>
      )}
      {NOTIFICATIONS.map((n, i) => {
        const flags = notifIconFlags(n.kind);
        return (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '13px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: flags.bg, color: flags.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <NotifIcon kind={n.kind} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{n.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{n.sub}</div>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{n.time}</div>
          </div>
        );
      })}
    </div>
  );
}
