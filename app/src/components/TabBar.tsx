import type { Tab } from '../store/types';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'finance', label: 'Finance', icon: '💰' },
  { key: 'tax', label: 'Tax', icon: '📋' },
  { key: 'ai', label: 'AI', icon: '✨' },
];

export function TabBar({ active, onSelect, onScan }: { active: Tab; onSelect: (t: Tab) => void; onScan: () => void }) {
  return (
    <nav
      className="material-chrome"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '10px max(10px, env(safe-area-inset-left)) calc(10px + env(safe-area-inset-bottom))',
        borderTop: '1.5px solid var(--color-divider)', maxWidth: 480, margin: '0 auto', width: '100%',
      }}
    >
      {TABS.slice(0, 2).map((t) => <TabButton key={t.key} tab={t} active={active === t.key} onSelect={onSelect} />)}
      <button
        type="button"
        onClick={onScan}
        className="pressable"
        aria-label="Scan receipt"
        style={{
          width: 52, height: 52, borderRadius: '50%', background: 'var(--color-accent)', color: '#fff',
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          cursor: 'pointer', boxShadow: 'var(--shadow-md)', flexShrink: 0,
        }}
      >
        📷
      </button>
      {TABS.slice(2).map((t) => <TabButton key={t.key} tab={t} active={active === t.key} onSelect={onSelect} />)}
    </nav>
  );
}

function TabButton({ tab, active, onSelect }: { tab: typeof TABS[number]; active: boolean; onSelect: (t: Tab) => void }) {
  return (
    <button
      type="button"
      className="tab-btn"
      onClick={() => onSelect(tab.key)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 3, padding: '4px 10px',
        color: active ? 'var(--color-accent-700)' : 'var(--color-text-muted)',
        fontWeight: active ? 700 : 500, fontFamily: 'var(--font-body)', fontSize: 11,
      }}
    >
      <span style={{ fontSize: 20 }}>{tab.icon}</span>
      {tab.label}
    </button>
  );
}
