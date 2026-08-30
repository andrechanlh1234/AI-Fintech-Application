import type { IconFlags } from '../lib/constants';
import { captureSharedOrigin } from '../lib/motion';

type RowIconProps = IconFlags & { hasBrand: boolean; badgeLetter: string };

export function TxIcon({ tx }: { tx: RowIconProps }) {
  if (tx.hasBrand) return <>{tx.badgeLetter}</>;
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (tx.isCar) return (
    <svg {...common}><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"></path><circle cx="6.5" cy="16.5" r="2.5"></circle><circle cx="16.5" cy="16.5" r="2.5"></circle></svg>
  );
  if (tx.isCoffee) return (
    <svg {...common}><path d="M17 8h1a4 4 0 1 1 0 8h-1"></path><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path><line x1="6" y1="2" x2="6" y2="4"></line><line x1="10" y1="2" x2="10" y2="4"></line><line x1="14" y1="2" x2="14" y2="4"></line></svg>
  );
  if (tx.isBag) return (
    <svg {...common}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
  );
  if (tx.isZap) return (
    <svg {...common}><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path></svg>
  );
  if (tx.isMedical) return (
    <svg {...common}><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>
  );
  if (tx.isBook) return (
    <svg {...common}><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg>
  );
  if (tx.isArrowUp) return (
    <svg {...common} stroke="var(--color-accent-700)"><path d="M7 17 17 7"></path><path d="M7 7h10v10"></path></svg>
  );
  // Every category without a hand-drawn SVG glyph above (the newer
  // Essential/Lifestyle categories, and the 'Other' catch-all) falls back
  // to its emoji rather than rendering nothing.
  if (tx.emoji) return <span style={{ fontSize: 15, lineHeight: 1 }}>{tx.emoji}</span>;
  return null;
}

export interface RowLike extends RowIconProps {
  merchant: string;
  badgeBg: string;
  badgeFg: string;
  amountLabel: string;
  amountColor: string;
  tax?: boolean;
  auto?: boolean;
}

/** One transaction/receipt-line-item row, shared by Record's full list and
 * Stats' per-category detail list so both present the exact same visual
 * language. Pass `onOpen` to make the row tappable (Record); omit it for a
 * read-only row (Stats' category breakdown). */
export function TransactionRow({
  tx, subtitle, onOpen, showTaxTag = false,
}: { tx: RowLike; subtitle: string; onOpen?: () => void; showTaxTag?: boolean }) {
  const clickable = !!onOpen;
  return (
    <button
      type="button"
      onClick={onOpen ? (e) => { captureSharedOrigin(e.currentTarget); onOpen(); } : undefined}
      disabled={!clickable}
      className="pressable"
      style={{
        all: 'unset', cursor: clickable ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 10px', margin: '0 -10px', width: 'calc(100% + 20px)', boxSizing: 'border-box',
        borderRadius: 'var(--radius-sm)', borderBottom: '1px solid var(--color-neutral-300)',
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: 12, background: tx.badgeBg, color: tx.badgeFg }}>
        <TxIcon tx={tx} />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{tx.merchant}</div>
        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 1 }}>{subtitle}</div>
      </div>
      {tx.auto && <span className="tag tag-neutral" style={{ flexShrink: 0 }}>Auto</span>}
      {showTaxTag && tx.tax && <span className="tag tag-tax" style={{ flexShrink: 0 }}>Tax</span>}
      <div className="type-numeric" style={{ fontWeight: 700, fontSize: 13.5, flexShrink: 0, color: tx.amountColor }}>{tx.amountLabel}</div>
    </button>
  );
}
