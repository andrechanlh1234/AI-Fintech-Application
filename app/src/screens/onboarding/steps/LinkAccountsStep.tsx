// Ported from Cukai v7.dc.html lines 289-347 (obIsLinkAccounts).
import type { AppState } from '../../../store/types';
import type { useActions } from '../../../store/StoreProvider';
import { LINK_TARGETS, linkBadgeLetter } from '../../../lib/constants';
import { StepHeader, CheckIcon } from './shared';

type Actions = ReturnType<typeof useActions>;

interface LinkTarget { id: string; name: string; badge: { bg: string } }

function LinkRow({ t, state, actions }: { t: LinkTarget; state: AppState; actions: Actions }) {
  const connecting = state.ob.connectingId === t.id;
  const linked = !connecting && state.ob.linkedIds.includes(t.id);
  const idle = !connecting && !linked;
  return (
    <button
      type="button" onClick={() => actions.toggleLinkTarget(t.id)} className="pressable"
      style={{
        all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        boxSizing: 'border-box', padding: '11px 0', borderBottom: '1px solid var(--color-neutral-300)',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 9, background: t.badge.bg, color: '#fff', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: 14,
      }}>
        {linkBadgeLetter(t.name)}
      </div>
      <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{t.name}</div>
      {connecting && <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>Connecting…</span>}
      {linked && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-accent-700)', fontSize: 11.5, fontWeight: 700 }}>
          <CheckIcon />Linked
        </span>
      )}
      {idle && <span style={{ fontSize: 11.5, color: 'var(--color-accent-700)', fontWeight: 700 }}>Connect</span>}
    </button>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: '16px 0 4px' }}>
      {children}
    </div>
  );
}

export function LinkAccountsStep({
  state, actions, progress, onBack, onSkip, onChooseManual, onChooseLink,
}: {
  state: AppState; actions: Actions; progress: string; onBack: () => void; onSkip: () => void;
  onChooseManual: () => void; onChooseLink: () => void;
}) {
  const linkedCount = state.ob.linkedIds.length;
  const linkContinueLabel = linkedCount > 0 ? `Continue (${linkedCount} connected)` : 'Continue without connecting';

  return (
    <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
      <StepHeader progress={progress} onBack={onBack} onSkip={onSkip} />
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>Connect your accounts</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 18 }}>
        Link your banks, cards, investments and wallets so Cukai can track everything automatically.
      </div>

      <SectionTitle>Bank accounts</SectionTitle>
      {LINK_TARGETS.banks.map((t) => <LinkRow key={t.id} t={t} state={state} actions={actions} />)}

      <SectionTitle>Credit cards</SectionTitle>
      {LINK_TARGETS.cards.map((t) => <LinkRow key={t.id} t={t} state={state} actions={actions} />)}

      <SectionTitle>Investments & brokerage</SectionTitle>
      {LINK_TARGETS.investing.map((t) => <LinkRow key={t.id} t={t} state={state} actions={actions} />)}

      <SectionTitle>Crypto wallets</SectionTitle>
      {LINK_TARGETS.crypto.map((t) => <LinkRow key={t.id} t={t} state={state} actions={actions} />)}

      <button
        type="button" onClick={onChooseManual} className="pressable"
        style={{ all: 'unset', cursor: 'pointer', display: 'block', textAlign: 'center', color: 'var(--color-accent-700)', font: '700 12.5px var(--font-body)', margin: '18px 0 4px', padding: '6px 0' }}
      >
        I'll enter my finances manually instead
      </button>
      <div style={{ flex: 1, minHeight: 16 }} />
      <button type="button" onClick={onChooseLink} className="btn btn-primary btn-lg">{linkContinueLabel}</button>
    </div>
  );
}
