import { useActions } from '../store/StoreProvider';
import { CATEGORY_OPTIONS } from '../lib/constants';
import { lineItemIsInvalid, lineItemNeedsReview, type ReceiptLineItemDraft } from '../lib/receipts';

function WarningIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
  );
}

/** One card per receipt line item -- description, amount, category, and a
 * tap-to-toggle "Potentially deductible" / "Not deductible" badge, plus a
 * remove button. Shared by ScanFlow's OCR review step and manual Detailed
 * Mode, so a scanned receipt and a hand-typed one produce identical
 * Transaction rows on save (see lib/receipts.ts's ReceiptLineItemDraft doc
 * comment). A row flagged lineItemNeedsReview() (OCR wasn't confident and
 * the user hasn't touched it yet) gets a warning border + banner; SAVE_RECEIPT
 * in the reducer refuses to save while any row is still flagged or invalid. */
export function ReceiptLineItemsEditor({ items }: { items: ReceiptLineItemDraft[] }) {
  const actions = useActions();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item) => {
        const flagged = lineItemNeedsReview(item);
        const invalid = lineItemIsInvalid(item);
        return (
          <div
            key={item.id}
            className="card"
            style={{
              display: 'flex', flexDirection: 'column', gap: 10, padding: 14,
              border: flagged ? '1.5px solid var(--color-danger-700)' : '1px solid var(--color-divider)',
              background: flagged ? 'color-mix(in srgb, var(--color-danger-700) 6%, var(--color-surface))' : 'var(--color-surface)',
            }}
          >
            {flagged && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-danger-700)', fontSize: 11.5, fontWeight: 700 }}>
                <WarningIcon /> Needs review
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                className="input" style={{ flex: 1.6 }} placeholder="Item description"
                value={item.description}
                onChange={(e) => actions.setLineItemDraftField(item.id, 'description', e.target.value)}
              />
              <input
                className="input" style={{ flex: 1 }} placeholder="0.00" inputMode="decimal"
                value={item.amount}
                onChange={(e) => actions.setLineItemDraftField(item.id, 'amount', e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <select
                className="input" style={{ flex: 1, minWidth: 120 }}
                value={item.cat}
                onChange={(e) => actions.setLineItemDraftField(item.id, 'cat', e.target.value)}
              >
                {CATEGORY_OPTIONS.filter((c) => c !== 'Income').map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <button
                type="button"
                onClick={() => actions.setLineItemDraftField(item.id, 'deductible', !item.deductible)}
                className="pressable"
                style={{
                  all: 'unset', cursor: 'pointer', padding: '7px 12px', borderRadius: 999, whiteSpace: 'nowrap',
                  font: '600 11.5px var(--font-body)',
                  background: item.deductible ? 'var(--color-tax-100)' : 'var(--color-neutral-200)',
                  color: item.deductible ? 'var(--color-tax-700)' : 'var(--color-text-muted)',
                }}
              >
                {item.deductible ? 'Potentially deductible' : 'Not deductible'}
              </button>
              <button
                type="button"
                onClick={() => actions.removeLineItemDraft(item.id)}
                aria-label="Remove item"
                className="pressable"
                style={{ all: 'unset', cursor: 'pointer', padding: 6, color: 'var(--color-text-muted)', marginLeft: 'auto' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            {invalid && !flagged && (
              <div style={{ fontSize: 11, color: 'var(--color-danger-700)' }}>Add a description and an amount to continue.</div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={actions.addLineItemDraft}
        className="pressable"
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent-700)', font: '700 12.5px var(--font-body)', padding: '8px 0' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" /><path d="M12 5v14" />
        </svg>
        Add item
      </button>
    </div>
  );
}
