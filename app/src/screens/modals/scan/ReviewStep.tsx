import { useRef, useState } from 'react';
import { useStore, useActions } from '../../../store/StoreProvider';
import { selectReceiptReview } from '../../../store/selectors';
import { categoryChip } from '../../../lib/constants';
import { ReceiptLineItemsEditor } from '../../../components/ReceiptLineItemsEditor';
import { formatWithCommas } from '../../../lib/format';
import { AmountKeypadSheet } from '../../../components/AmountKeypadSheet';
import { DateField, SelectField } from './shared';
import { CategoryPickerOverlay } from './CategoryPickerOverlay';
import { RELIEF_INFO } from '../../../lib/taxEngine';

const PAYMENT_METHODS = ['Cash', 'Credit Card', 'E-wallet', 'Transfer'];

export function ReviewStep({ onClose, onImportPhoto, photoUrl }: {
  onClose: () => void;
  onImportPhoto: (file: File) => void;
  /** The actual photo this receipt was scanned from, if any -- kept
   * visible at the top of the screen throughout review (see the receipt
   * anchor below) instead of only shown once during capture, so filling in
   * the fields below reads as confirming against a real object rather than
   * filling in an abstract form. */
  photoUrl: string | null;
}) {
  const { state } = useStore();
  const actions = useActions();
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [amountSheetOpen, setAmountSheetOpen] = useState(false);
  const review = selectReceiptReview(state);
  const draft = state.receiptDraft;

  return (
    <div className="screen-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 24px', boxSizing: 'border-box', overflow: 'auto', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="pressable"
          style={{ background: 'none', border: 'none', padding: 8, marginLeft: -8, cursor: 'pointer', color: 'var(--color-text)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"></path></svg>
        </button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>
          {state.scanMethod === 'photo' ? 'Review receipt' : 'Enter expense details'}
        </span>
      </div>
      {state.scanMethod === 'photo' && photoUrl && (
        <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 12, height: 160, flexShrink: 0 }}>
          <img src={photoUrl} alt="Your scanned receipt" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <span style={{
            position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff',
            font: '600 10.5px var(--font-body)', padding: '3px 9px', borderRadius: 999,
          }}>
            Your receipt
          </span>
        </div>
      )}
      {state.scanMethod === 'photo' && (
        <div className="tag tag-accent" style={{ alignSelf: 'flex-start', marginBottom: 16 }}>Read from your photo — check it's right</div>
      )}

      {state.scanMethod === 'manual' && (
        <>
          <input
            ref={importFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onImportPhoto(file);
            }}
          />
          <button
            type="button"
            onClick={() => importFileInputRef.current?.click()}
            className="pressable"
            style={{
              all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--color-accent-100)', color: 'var(--color-accent-800)',
              borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 18,
              font: '700 12.5px var(--font-body)', boxSizing: 'border-box', width: '100%',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" />
            </svg>
            Import a receipt photo instead
          </button>
        </>
      )}

      <div className="card elev-sm" style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setAmountSheetOpen(true)}
          className="pressable"
          style={{
            all: 'unset', cursor: 'pointer', width: '100%', boxSizing: 'border-box',
            padding: '4px 0 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
            <span style={{ font: '700 20px var(--font-heading)', color: 'var(--color-text-muted)' }}>RM</span>
            <span className="type-numeric" style={{ font: '700 44px var(--font-heading)', color: 'var(--color-text)' }}>
              {draft.total ? formatWithCommas(draft.total) : '0.00'}
            </span>
          </div>
        </button>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-2)' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Date</label>
            <DateField value={draft.date} onChange={(iso) => actions.setReceiptDraftField('date', iso)} />
          </div>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Payment method</label>
            <SelectField
              value={PAYMENT_METHODS.includes(state.scanPaymentMethod) ? state.scanPaymentMethod : 'Cash'}
              options={PAYMENT_METHODS}
              onChange={actions.setScanPaymentMethod}
              ariaLabel="Payment method"
            />
          </div>
        </div>

        <div className="field" style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <label>Expense name</label>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{draft.merchant.length}/40</span>
          </div>
          <input
            className="input"
            maxLength={40}
            placeholder="Enter expense name"
            value={draft.merchant}
            onChange={(e) => actions.setReceiptDraftField('merchant', e.target.value)}
          />
        </div>

        <div className="field" style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-2)' }}>
          <label>Vendor / Merchant</label>
          <input
            className="input"
            placeholder="Enter vendor or merchant"
            value={draft.vendor}
            onChange={(e) => actions.setReceiptDraftField('vendor', e.target.value)}
          />
        </div>

        {state.receiptDraft.mode === 'quick' && (
          <button
            type="button"
            onClick={() => setCategoryPickerOpen(true)}
            className="pressable"
            style={{
              all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-2)', boxSizing: 'border-box', width: '100%',
            }}
          >
            <span style={{ fontSize: 12, color: 'color-mix(in srgb, var(--color-text) 70%, transparent)' }}>Category</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Same circle colour + emoji CategoryPickerOverlay itself
                  renders for this category (via categoryChip) -- this used
                  to be TxIcon in a flat grey circle, which is the right
                  look for a transaction row but didn't match what tapping
                  this row actually opens into (bug report, 2026-09-05). */}
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: categoryChip(draft.quickCategory).bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, lineHeight: 1 }}>
                {categoryChip(draft.quickCategory).emoji}
              </span>
              <span style={{ font: '600 13.5px var(--font-body)', color: 'var(--color-text)' }}>{draft.quickCategory}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"></path></svg>
            </span>
          </button>
        )}
      </div>

      {/* Quick mode only -- "Add line items" mode has its own per-line
          deductible toggle (ReceiptLineItemsEditor), which doesn't need a
          reasoning note repeated on every row the way a single receipt-level
          decision does here. */}
      {draft.mode === 'quick' && (() => {
        const relief = RELIEF_INFO[draft.quickCategory];
        return (
          <div
            style={{
              border: `1.5px solid ${draft.tax ? 'var(--color-tax-300)' : 'var(--color-neutral-300)'}`,
              background: draft.tax ? 'var(--color-tax-100)' : 'var(--color-surface)',
              borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 18, boxSizing: 'border-box',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              {draft.tax ? 'Tax deductible' : 'Not tax deductible'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
              {relief
                ? `${relief.why} Counts toward ${relief.name} (RM ${relief.cap.toLocaleString()} cap/year).`
                : `${draft.quickCategory} doesn't have a matching LHDN relief category, so it isn't counted toward your tax reliefs by default.`}
            </div>
            <div className="seg">
              <label className="seg-opt">
                <input type="radio" name="receiptDeductible" checked={draft.tax} onChange={() => actions.setReceiptDraftField('tax', true)} />
                Yes
              </label>
              <label className="seg-opt">
                <input type="radio" name="receiptDeductible" checked={!draft.tax} onChange={() => actions.setReceiptDraftField('tax', false)} />
                No
              </label>
            </div>
          </div>
        );
      })()}

      {/* Available for scanned receipts too now: a multi-item scan lands in
          "Add line items", but the user can collapse it to a single Quick
          expense (one name, one category) if that's all they want logged. */}
      <div className="seg" style={{ marginBottom: 18 }}>
        <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
          <input type="radio" name="receiptMode" checked={draft.mode === 'quick'} onChange={() => actions.setReceiptMode('quick')} />
          Quick
        </label>
        <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
          <input type="radio" name="receiptMode" checked={draft.mode === 'detailed'} onChange={() => actions.setReceiptMode('detailed')} />
          Add line items
        </label>
      </div>

      {draft.mode === 'detailed' && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Line items
          </div>
          <ReceiptLineItemsEditor items={state.lineItemDrafts} />
          {review.hasMismatch && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--color-danger-100)', border: '1px solid var(--color-danger-700)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-danger-700)', marginBottom: 4 }}>
                ⚠ Receipt total doesn't match line items
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--color-danger-700)', marginBottom: review.mismatchAmount > 0 ? 8 : 0 }}>
                Line items add up to RM {review.lineItemsTotal.toFixed(2)}, but the receipt total is RM {(parseFloat(draft.total) || 0).toFixed(2)}.
              </div>
              {review.mismatchAmount > 0 && (
                <button
                  type="button"
                  onClick={() => actions.addAdjustmentLineItem(review.mismatchAmount)}
                  className="pressable"
                  style={{ all: 'unset', cursor: 'pointer', color: 'var(--color-danger-700)', font: '700 11.5px var(--font-body)', textDecoration: 'underline' }}
                >
                  Add a RM {review.mismatchAmount.toFixed(2)} adjustment line to match
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Receipt-level tax summary for the scan / "Add line items" path.
          Quick mode has its own single Yes/No note above; detailed mode
          decides per item (badge on each row), so this recaps the result
          and points back at those controls -- so every path ends with a
          clear "is this deductible, and why" note before Save. */}
      {draft.mode === 'detailed' && state.lineItemDrafts.length > 0 && (() => {
        const deductible = state.lineItemDrafts.filter((i) => i.deductible);
        const sum = deductible.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const any = deductible.length > 0;
        return (
          <div
            style={{
              border: `1.5px solid ${any ? 'var(--color-tax-300)' : 'var(--color-neutral-300)'}`,
              background: any ? 'var(--color-tax-100)' : 'var(--color-surface)',
              borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 18, boxSizing: 'border-box',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              {any
                ? `${deductible.length} of ${state.lineItemDrafts.length} item${state.lineItemDrafts.length === 1 ? '' : 's'} tax deductible`
                : 'Not tax deductible'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {any
                ? `About RM ${sum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will count toward your tax reliefs. Tap the badge on any item above to change what's included.`
                : 'No item is marked deductible. If something here qualifies for an LHDN relief, tap its badge above to include it.'}
            </div>
          </div>
        );
      })()}

      <div style={{ flex: 1 }} />
      {state.scanError && (
        <div
          role="alert"
          style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            background: 'var(--color-danger-100)', border: '1px solid var(--color-danger-700)',
            color: 'var(--color-danger-700)', borderRadius: 'var(--radius-md)',
            padding: '10px 12px', marginBottom: 12, font: '600 12px var(--font-body)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
          </svg>
          {state.scanError}
        </div>
      )}
      <button
        type="button"
        onClick={actions.saveReceipt}
        disabled={draft.mode === 'detailed' && !review.canSaveDetailed}
        className="btn btn-primary btn-lg"
        style={{ opacity: draft.mode === 'detailed' && !review.canSaveDetailed ? 0.5 : 1 }}
      >
        {draft.mode === 'quick' ? 'Save receipt' : `Confirm ${state.lineItemDrafts.length || ''} transaction${state.lineItemDrafts.length === 1 ? '' : 's'}`}
      </button>

      <CategoryPickerOverlay
        open={categoryPickerOpen}
        value={draft.quickCategory}
        onSelect={(cat) => actions.setReceiptDraftField('quickCategory', cat)}
        onClose={() => setCategoryPickerOpen(false)}
      />

      <AmountKeypadSheet
        open={amountSheetOpen}
        value={draft.total}
        onClose={() => setAmountSheetOpen(false)}
        onSave={(v) => actions.setReceiptDraftField('total', v)}
      />
    </div>
  );
}
