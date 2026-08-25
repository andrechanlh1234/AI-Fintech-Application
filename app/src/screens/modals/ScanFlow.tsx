import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { selectReceiptReview } from '../../store/selectors';
import { CATEGORY_OPTIONS, paymentMethodOptions, iconFlags, subBadge } from '../../lib/constants';
import { todayIso, isoToDisplayDate } from '../../lib/format';
import { ReceiptLineItemsEditor } from '../../components/ReceiptLineItemsEditor';
import { HeroAmountInput } from '../../components/HeroAmountInput';
import { TxIcon } from '../../components/TransactionRow';
import type { ManualData } from '../../store/types';

type Actions = ReturnType<typeof useActions>;

// Quick-mode receipts always save as an expense (see SAVE_RECEIPT in
// reducer.ts) -- 'Income' has no place here, unlike CATEGORY_OPTIONS'
// full list, which also feeds pickers that do need it.
const RECEIPT_CATEGORY_OPTIONS = CATEGORY_OPTIONS.filter((c) => c !== 'Income');

function chipStyle(active: boolean): CSSProperties {
  return {
    all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', borderRadius: 999, font: '600 12px var(--font-body)',
    border: '1.5px solid', borderColor: active ? 'var(--color-accent)' : 'var(--color-neutral-400)',
    background: active ? 'var(--color-accent)' : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text-muted)', boxSizing: 'border-box',
  };
}

function CategoryChips({ value, onChange }: { value: string; onChange: (cat: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      {RECEIPT_CATEGORY_OPTIONS.map((opt) => {
        const active = value === opt;
        return (
          <button key={opt} type="button" onClick={() => onChange(opt)} className="pressable" style={chipStyle(active)}>
            <TxIcon tx={{ ...iconFlags(opt), hasBrand: false, badgeLetter: '' }} />
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// "Today" covers the overwhelming majority of entries with zero taps (it's
// selected the instant the screen opens); "Pick a date" is a real
// <input type="date"> sitting invisibly over the chip, so tapping it opens
// the device's own date UI (Apple's wheel on iOS) instead of a custom
// calendar -- same reasoning as HeroAmountInput using inputMode="decimal"
// instead of a custom keypad.
function DateChips({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const today = todayIso();
  const isToday = value === today;
  const pickLabel = isToday ? 'Pick a date' : isoToDisplayDate(value).replace(/ \d{4}$/, '');
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" onClick={() => onChange(today)} className="pressable" style={chipStyle(isToday)}>
        Today
      </button>
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <span className="pressable" style={chipStyle(!isToday)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {pickLabel}
        </span>
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label="Pick a date"
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', border: 'none', width: '100%' }}
        />
      </div>
    </div>
  );
}

// Real linked accounts (from onboarding) first, generic wallets after --
// paymentMethodOptions() already builds exactly that list; this just draws
// it as brand-colored chips (subBadge(), same as Net Worth and
// subscriptions use) instead of a flat <select>. "+" lets someone add a
// method that isn't linked and isn't one of the generic fallbacks --
// picking it immediately makes it a chip on this and future receipts,
// since paymentMethodOptions() always includes the current value.
function PaymentChips({ manual, value, onChange }: { manual: ManualData; value: string; onChange: (v: string) => void }) {
  const options = paymentMethodOptions(manual, value);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) onChange(trimmed);
    setAdding(false);
    setDraft('');
  };
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {options.map((opt) => {
        const active = value === opt;
        const badge = subBadge(opt);
        return (
          <button key={opt} type="button" onClick={() => onChange(opt)} className="pressable" style={chipStyle(active)}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: badge.bg, color: badge.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 8.5px var(--font-body)', flexShrink: 0 }}>
              {badge.letter}
            </span>
            {opt}
          </button>
        );
      })}
      {adding ? (
        <input
          autoFocus
          className="input"
          style={{ width: 150, padding: '7px 10px', font: '600 12px var(--font-body)' }}
          placeholder="Payment method name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label="Add payment method"
          className="pressable"
          style={{ ...chipStyle(false), width: 32, height: 32, padding: 0, justifyContent: 'center' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
        </button>
      )}
    </div>
  );
}

const TAX_PRESETS = [6, 8];
const SERVICE_PRESETS = [10];

function RateField({
  label, presets, rate, amount, note, onPreset, onAmountChange,
}: {
  label: string; presets: number[]; rate: string; amount: string; note?: string;
  onPreset: (rate: number) => void; onAmountChange: (v: string) => void;
}) {
  return (
    <div>
      <div style={{ font: '600 11px var(--font-body)', color: 'var(--color-text-muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {presets.map((p) => (
          <button key={p} type="button" onClick={() => onPreset(p)} className="pressable" style={chipStyle(parseFloat(rate || '0') === p)}>
            {p}%
          </button>
        ))}
      </div>
      <div className="field">
        <label>Amount (RM)</label>
        <input className="input" value={amount} onChange={(e) => onAmountChange(e.target.value)} placeholder="0.00" />
        {note && (
          <div style={{ fontSize: 11, color: 'var(--color-accent-700)', marginTop: 5, fontWeight: 600 }}>
            {note} — edit if it's off
          </div>
        )}
      </div>
    </div>
  );
}

// Collapsed by default -- most receipts have no separate tax/service line
// worth recording. Auto-opens the moment either field actually has a value
// (an OCR-detected line, or a preset tapped before this render), and stays
// open if the user closes then re-opens it manually.
function TaxServiceSection({
  taxAmount, taxRate, taxNote, serviceAmount, serviceRate, serviceNote, actions,
}: {
  taxAmount: string; taxRate: string; taxNote?: string;
  serviceAmount: string; serviceRate: string; serviceNote?: string; actions: Actions;
}) {
  const hasData = !!(taxAmount || serviceAmount);
  const [open, setOpen] = useState(hasData);
  useEffect(() => { if (hasData) setOpen(true); }, [hasData]);

  return (
    <div style={{ marginBottom: 18 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="pressable"
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent-700)', font: '700 12.5px var(--font-body)' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
        {open ? 'Hide tax / service charge' : 'Add tax or service charge'}
      </button>
      {open && (
        <div className="pop-in" style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RateField
            label="Tax (SST)" presets={TAX_PRESETS} rate={taxRate} amount={taxAmount} note={taxNote}
            onPreset={(r) => actions.applyTaxPreset(r)}
            onAmountChange={(v) => actions.setReceiptDraftField('taxAmount', v)}
          />
          <RateField
            label="Service charge" presets={SERVICE_PRESETS} rate={serviceRate} amount={serviceAmount} note={serviceNote}
            onPreset={(r) => actions.applyServicePreset(r)}
            onAmountChange={(v) => actions.setReceiptDraftField('serviceChargeAmount', v)}
          />
        </div>
      )}
    </div>
  );
}

export function ScanFlow() {
  const { state } = useStore();
  const actions = useActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [liveCameraReady, setLiveCameraReady] = useState(false);

  const onCaptureStep = state.scanOpen && state.scanStep === 'capture';

  // A real live viewfinder, not just a decorative frame — matches what
  // "Align the receipt within the frame" actually implies. getUserMedia
  // only works in a secure context (https, or localhost) though, so this
  // quietly falls back to the native camera-app picker (the file input
  // below, which has no such restriction) wherever it isn't available —
  // e.g. testing over a plain-http LAN IP from a phone.
  useEffect(() => {
    if (!onCaptureStep) return;
    let cancelled = false;
    setLiveCameraReady(false);

    if (!navigator.mediaDevices?.getUserMedia) return;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setLiveCameraReady(true);
      })
      .catch(() => { /* permission denied / no camera — fall back to the file input */ });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onCaptureStep]);

  const captureFromLiveVideo = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) actions.capturePhotoFile(new File([blob], 'receipt.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  const handleCaptureClick = () => {
    if (liveCameraReady) captureFromLiveVideo();
    else fileInputRef.current?.click();
  };

  if (!state.scanOpen) return null;

  const review = selectReceiptReview(state);

  return (
    <div
      className="screen-in"
      style={{
        position: 'absolute', inset: 0, zIndex: 40, background: 'var(--color-bg)',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      }}
    >
      {state.scanStep === 'capture' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg,#2a2c2b,#0f100f)', position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', position: 'relative', zIndex: 5 }}>
            <button
              type="button"
              onClick={actions.closeScan}
              aria-label="Close"
              className="pressable"
              style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
            </button>
            <span style={{ font: '600 13px var(--font-body)', color: 'rgba(255,255,255,0.85)', letterSpacing: '0.02em' }}>Scan a receipt</span>
            {/* Balances the close button so the title stays centered --
                there used to be a second control here (a static sparkle
                icon with no onClick, doing nothing) which was removed. */}
            <div style={{ width: 36, height: 36 }} />
          </div>
          <div style={{ flex: 1, position: 'relative', margin: '8px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12 }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                opacity: liveCameraReady ? 1 : 0, transition: 'opacity .2s ease',
              }}
            />
            <div style={{ position: 'absolute', top: 0, left: 0, width: 34, height: 34, borderTop: '3px solid rgba(255,255,255,0.85)', borderLeft: '3px solid rgba(255,255,255,0.85)', borderRadius: '8px 0 0 0' }} />
            <div style={{ position: 'absolute', top: 0, right: 0, width: 34, height: 34, borderTop: '3px solid rgba(255,255,255,0.85)', borderRight: '3px solid rgba(255,255,255,0.85)', borderRadius: '0 8px 0 0' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: 34, height: 34, borderBottom: '3px solid rgba(255,255,255,0.85)', borderLeft: '3px solid rgba(255,255,255,0.85)', borderRadius: '0 0 0 8px' }} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 34, height: 34, borderBottom: '3px solid rgba(255,255,255,0.85)', borderRight: '3px solid rgba(255,255,255,0.85)', borderRadius: '0 0 8px 0' }} />
            {!liveCameraReady && (
              <span style={{ font: '500 13px var(--font-body)', color: 'rgba(255,255,255,0.55)', position: 'relative' }}>
                Align the receipt within the frame
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '22px 0 34px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) actions.capturePhotoFile(file);
              }}
            />
            <button
              type="button"
              onClick={handleCaptureClick}
              aria-label="Capture"
              className="pressable"
              style={{
                width: 66, height: 66, padding: 0, borderRadius: '50%', background: 'transparent',
                border: '4px solid #fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxSizing: 'border-box', flexShrink: 0,
              }}
            >
              {/* Was a plain white fill -- the same button-padding quirk that
                  squeezed this into a visible oval (a native <button> never had
                  its default padding reset, so the flex-shrinking child dot lost
                  width but not height) also motivated giving it the app's AI
                  gradient instead of leaving it a bare white dot. */}
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#4d7cf7,#9868d9,#e26b95)', flexShrink: 0 }} />
            </button>
            <button
              type="button"
              onClick={actions.chooseManual}
              className="pressable"
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', font: '600 13px var(--font-body)', cursor: 'pointer' }}
            >
              Enter details manually instead
            </button>
          </div>
        </div>
      )}

      {state.scanStep === 'processing' && (
        <div className="screen-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg,#2a2c2b,#0f100f)', position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
          <div style={{ flex: 1, position: 'relative', margin: '24px 32px', background: '#fff', borderRadius: 6, boxShadow: '0 20px 50px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 14, right: 14, top: 14 }}>
              <div style={{ height: 9, background: '#e7e5e2', width: '70%', marginBottom: 8 }} />
              <div style={{ height: 5, background: '#eee', width: '90%', marginBottom: 5 }} />
              <div style={{ height: 5, background: '#eee', width: '82%', marginBottom: 5 }} />
              <div style={{ height: 5, background: '#eee', width: '86%', marginBottom: 16 }} />
              <div style={{ height: 5, background: '#eee', width: '60%', marginBottom: 5 }} />
              <div style={{ height: 5, background: '#eee', width: '70%' }} />
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, top: '8%', height: 3, background: 'linear-gradient(90deg,transparent,var(--color-accent-500),transparent)', animation: 'scanSweep 1.3s ease-in-out infinite' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '6px 0 40px' }}>
            <span style={{ font: '600 14px var(--font-body)', color: '#fff' }}>
              Reading your receipt
              <span style={{ animation: 'dotBlink 1.4s infinite' }}>.</span>
              <span style={{ animation: 'dotBlink 1.4s infinite .2s' }}>.</span>
              <span style={{ animation: 'dotBlink 1.4s infinite .4s' }}>.</span>
            </span>
            <span style={{ font: '400 12px var(--font-body)', color: 'rgba(255,255,255,0.5)' }}>Cukai is finding the merchant, amount and category</span>
          </div>
        </div>
      )}

      {state.scanStep === 'review' && (
        <div className="screen-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px 24px', boxSizing: 'border-box', overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <button
              type="button"
              onClick={actions.closeScan}
              aria-label="Back"
              className="pressable"
              style={{ background: 'none', border: 'none', padding: 8, marginLeft: -8, cursor: 'pointer', color: 'var(--color-text)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"></path></svg>
            </button>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>{state.scanMethod === 'photo' ? 'Review receipt' : 'Add receipt'}</span>
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
                  if (file) actions.capturePhotoFile(file);
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

          {state.scanError && (
            <div style={{ fontSize: 12, color: 'var(--color-danger-700)', marginTop: -8, marginBottom: 16 }}>
              Couldn't read that photo automatically ({state.scanError}) — enter the details below instead.
            </div>
          )}

          <div className="field" style={{ marginBottom: 14 }}>
            <label>Merchant</label>
            <input className="input" value={state.receiptDraft.merchant} onChange={(e) => actions.setReceiptDraftField('merchant', e.target.value)} />
          </div>

          {/* Tapping this brings up the device's own number keyboard --
              it's a real input, not a custom keypad -- because the amount
              is the one field on this whole screen a user looks at hardest. */}
          <div style={{ marginBottom: 20, padding: '14px 0 18px' }}>
            <HeroAmountInput value={state.receiptDraft.total} onChange={(v) => actions.setReceiptDraftField('total', v)} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>Date</div>
            <DateChips value={state.receiptDraft.date} onChange={(iso) => actions.setReceiptDraftField('date', iso)} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>Payment method</div>
            <PaymentChips manual={state.ob.manual} value={state.scanPaymentMethod} onChange={actions.setScanPaymentMethod} />
          </div>
          <TaxServiceSection
            taxAmount={state.receiptDraft.taxAmount} taxRate={state.receiptDraft.taxRate} taxNote={state.receiptDraft.taxSuggestionNote}
            serviceAmount={state.receiptDraft.serviceChargeAmount} serviceRate={state.receiptDraft.serviceChargeRate} serviceNote={state.receiptDraft.serviceSuggestionNote}
            actions={actions}
          />

          {state.scanMethod === 'manual' && (
            <div className="seg" style={{ marginBottom: 18 }}>
              <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
                <input type="radio" name="receiptMode" checked={state.receiptDraft.mode === 'quick'} onChange={() => actions.setReceiptMode('quick')} />
                Quick
              </label>
              <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
                <input type="radio" name="receiptMode" checked={state.receiptDraft.mode === 'detailed'} onChange={() => actions.setReceiptMode('detailed')} />
                Add line items
              </label>
            </div>
          )}

          {state.receiptDraft.mode === 'quick' ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 10, textAlign: 'center' }}>
                Category
              </div>
              <CategoryChips value={state.receiptDraft.quickCategory} onChange={(cat) => actions.setReceiptDraftField('quickCategory', cat)} />
            </div>
          ) : (
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
                    Line items add up to RM {review.lineItemsTotal.toFixed(2)}, but the receipt total is RM {(parseFloat(state.receiptDraft.total) || 0).toFixed(2)}.
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
            disabled={state.receiptDraft.mode === 'detailed' && !review.canSaveDetailed}
            className="btn btn-primary btn-lg"
            style={{ opacity: state.receiptDraft.mode === 'detailed' && !review.canSaveDetailed ? 0.5 : 1 }}
          >
            {state.receiptDraft.mode === 'quick' ? 'Save receipt' : `Confirm ${state.lineItemDrafts.length || ''} transaction${state.lineItemDrafts.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {state.scanStep === 'saved' && (() => {
        const lastReceipt = state.receipts[state.receipts.length - 1];
        const savedTx = lastReceipt ? state.transactions.filter((t) => t.receiptId === lastReceipt.id) : [];
        const anyDeductible = savedTx.some((t) => t.tax);
        return (
          <div className="screen-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px 24px', boxSizing: 'border-box', textAlign: 'center', minHeight: '100vh' }}>
            <div className="pop-in" style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Saved</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24, maxWidth: '26ch' }}>
              {savedTx.length === 1 ? 'Linked to a new transaction in your Finance tab.' : `Split into ${savedTx.length} transactions in your Finance tab.`}
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {savedTx.map((tx) => (
                <div key={tx.id} className="card elev-sm" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{tx.merchant}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{tx.cat} · {tx.dateLabel}</div>
                    </div>
                    <div className="type-numeric" style={{ fontWeight: 700, fontSize: 15 }}>−RM {Math.abs(tx.amount).toFixed(2)}</div>
                  </div>
                  {tx.tax && <div className="tag tag-tax" style={{ alignSelf: 'flex-start', marginTop: 6 }}>Potentially deductible</div>}
                </div>
              ))}
            </div>

            {anyDeductible && (
              <button
                type="button"
                onClick={actions.viewInTax}
                className="pressable"
                style={{ width: '100%', textAlign: 'left', background: 'var(--color-tax-100)', border: '1.5px solid var(--color-tax-300)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxSizing: 'border-box' }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-tax-800)' }}>Added to your potential deductions</div>
                  <div style={{ fontSize: 11, color: 'var(--color-tax-700)', marginTop: 2 }}>Tap to see it in your Tax Center</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-tax-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
              </button>
            )}

            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button type="button" onClick={actions.scanAnother} className="btn btn-secondary" style={{ flex: 1 }}>Scan another</button>
              <button type="button" onClick={actions.closeScan} className="btn btn-primary" style={{ flex: 1 }}>Done</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
