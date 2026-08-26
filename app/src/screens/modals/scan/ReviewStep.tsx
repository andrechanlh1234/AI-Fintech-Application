import { useRef, useState } from 'react';
import { useStore, useActions } from '../../../store/StoreProvider';
import { selectReceiptReview } from '../../../store/selectors';
import { iconFlags } from '../../../lib/constants';
import { TxIcon } from '../../../components/TransactionRow';
import { ReceiptLineItemsEditor } from '../../../components/ReceiptLineItemsEditor';
import { HeroAmountInput } from '../../../components/HeroAmountInput';
import { chipStyle, DateChips, PaymentChips } from './shared';
import { CategoryPickerOverlay } from './CategoryPickerOverlay';

const EXPENSE_NAME_SUGGESTIONS = ['Lunch', 'Groceries', 'Transport', 'Coffee'];

export function ReviewStep({ onClose, onImportPhoto }: {
  onClose: () => void;
  onImportPhoto: (file: File) => void;
}) {
  const { state } = useStore();
  const actions = useActions();
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const review = selectReceiptReview(state);
  const draft = state.receiptDraft;

  return (
    <div className="screen-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px 24px', boxSizing: 'border-box', overflow: 'auto', position: 'relative' }}>
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
        <div className="field">
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {EXPENSE_NAME_SUGGESTIONS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => actions.setReceiptDraftField('merchant', label)}
                className="pressable"
                style={chipStyle(draft.merchant === label)}
              >
                {label}
              </button>
            ))}
          </div>
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

        <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-2)', padding: '14px 0 4px' }}>
          <HeroAmountInput value={draft.total} onChange={(v) => actions.setReceiptDraftField('total', v)} />
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
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--color-neutral-200)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TxIcon tx={{ ...iconFlags(draft.quickCategory), hasBrand: false, badgeLetter: '' }} />
              </span>
              <span style={{ font: '600 13.5px var(--font-body)', color: 'var(--color-text)' }}>{draft.quickCategory}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"></path></svg>
            </span>
          </button>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>Date</div>
        <DateChips value={draft.date} onChange={(iso) => actions.setReceiptDraftField('date', iso)} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>Payment method</div>
        <PaymentChips manual={state.ob.manual} value={state.scanPaymentMethod} onChange={actions.setScanPaymentMethod} />
      </div>

      {state.scanMethod === 'manual' && (
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
      )}

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

      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={actions.saveReceipt}
        disabled={draft.mode === 'detailed' && !review.canSaveDetailed}
        className="btn btn-primary btn-lg"
        style={{ opacity: draft.mode === 'detailed' && !review.canSaveDetailed ? 0.5 : 1 }}
      >
        {draft.mode === 'quick' ? 'Save receipt' : `Confirm ${state.lineItemDrafts.length || ''} transaction${state.lineItemDrafts.length === 1 ? '' : 's'}`}
      </button>

      {categoryPickerOpen && (
        <CategoryPickerOverlay
          value={draft.quickCategory}
          onSelect={(cat) => actions.setReceiptDraftField('quickCategory', cat)}
          onClose={() => setCategoryPickerOpen(false)}
        />
      )}
    </div>
  );
}
