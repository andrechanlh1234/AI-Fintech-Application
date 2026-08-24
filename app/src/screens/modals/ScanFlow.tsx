import { useEffect, useRef, useState } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { selectReliefImpact } from '../../store/selectors';
import { CATEGORY_OPTIONS, paymentMethodOptions } from '../../lib/constants';

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

  const relief = selectReliefImpact(state);
  const taxYearLabel = state.taxYear.replace('YA', '');

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

      {state.scanStep === 'confirm' && (
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
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>Confirm details</span>
          </div>
          <div className="tag tag-accent" style={{ alignSelf: 'flex-start', marginBottom: 16 }}>
            {state.scanMethod === 'photo' ? "Read from your photo — check it's right" : 'Enter the receipt details'}
          </div>

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
            <input className="input" value={state.scanMerchant} onChange={(e) => actions.setScanMerchant(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Amount (RM)</label>
              <input className="input" value={state.scanAmount} onChange={(e) => actions.setScanAmount(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Date</label>
              <input className="input" value={state.scanDate} onChange={(e) => actions.setScanDate(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Category</label>
            <select className="input" value={state.scanCategory} onChange={(e) => actions.setScanCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Payment method</label>
            <select className="input" value={state.scanPaymentMethod} onChange={(e) => actions.setScanPaymentMethod(e.target.value)}>
              {paymentMethodOptions(state.ob.manual, state.scanPaymentMethod).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Tax amount (RM)</label>
              <input className="input" value={state.scanTaxAmount} onChange={(e) => actions.setScanTaxAmount(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Tax rate (%)</label>
              <input className="input" value={state.scanTaxRate} onChange={(e) => actions.setScanTaxRate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Service charge (RM)</label>
              <input className="input" value={state.scanServiceChargeAmount} onChange={(e) => actions.setScanServiceChargeAmount(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Service charge (%)</label>
              <input className="input" value={state.scanServiceChargeRate} onChange={(e) => actions.setScanServiceChargeRate(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Receipt tag (optional)</label>
            <input className="input" value={state.scanTag} onChange={(e) => actions.setScanTag(e.target.value)} placeholder="e.g. Work trip, gift" />
          </div>

          <div
            style={{
              border: `1.5px solid ${state.scanDeductible ? 'var(--color-tax-300)' : 'var(--color-neutral-300)'}`,
              background: state.scanDeductible ? 'var(--color-tax-100)' : 'var(--color-surface)',
              borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 20,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Tax deductible?</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>Cukai thinks this qualifies for a relief this year</div>
            <div className="seg">
              <label className="seg-opt">
                <input type="radio" name="deductible" checked={state.scanDeductible} onChange={actions.setScanDeductibleYes} />
                Yes
              </label>
              <label className="seg-opt">
                <input type="radio" name="deductible" checked={!state.scanDeductible} onChange={actions.setScanDeductibleNo} />
                No
              </label>
            </div>

            {state.scanDeductible && (
              <>
                <button
                  type="button"
                  onClick={actions.toggleWhyDeductible}
                  className="pressable"
                  style={{ background: 'none', border: 'none', padding: '12px 0 0', margin: 0, font: '600 12.5px var(--font-body)', color: 'var(--color-tax-700)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  Why does this qualify?
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: state.showWhyDeductible ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }}>
                    <path d="m9 18 6-6-6-6"></path>
                  </svg>
                </button>

                {state.showWhyDeductible && (
                  <div className="pop-in" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-tax-300)' }}>
                    <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-tax-900)', marginBottom: 12 }}>
                      {relief.hasReliefInfo ? relief.why : 'This purchase may qualify for a relief this year.'}
                    </div>
                    {relief.hasReliefInfo && (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>{relief.name} · cap RM {relief.capLabel}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-tax-700)', marginBottom: 4 }}>
                          <span>Before this purchase</span><span>RM {relief.beforeLabel}</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--color-tax-200)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                          <div className="bar-fill" style={{ height: '100%', width: `${relief.beforePct}%`, background: 'var(--color-tax-500)', borderRadius: 4 }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-tax-800)', marginBottom: 4, fontWeight: 600 }}>
                          <span>After this purchase</span><span>RM {relief.afterLabel}</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--color-tax-200)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                          <div className="bar-fill" style={{ height: '100%', width: `${relief.afterPct}%`, background: 'var(--color-tax-700)', borderRadius: 4 }} />
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-tax-700)' }}>RM {relief.remainingLabel} of your cap will remain</div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ flex: 1 }} />
          <button type="button" onClick={actions.saveScan} className="btn btn-primary btn-lg">Save receipt</button>
        </div>
      )}

      {state.scanStep === 'saved' && (
        <div className="screen-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px 24px', boxSizing: 'border-box', textAlign: 'center', minHeight: '100vh' }}>
          <div className="pop-in" style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Saved</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24, maxWidth: '26ch' }}>Linked to a new transaction in your Finance tab.</div>

          <div className="card elev-sm" style={{ width: '100%', textAlign: 'left', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{state.scanMerchant}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{state.scanCategory} · {state.scanDate}</div>
              </div>
              <div className="type-numeric" style={{ fontWeight: 700, fontSize: 15 }}>−RM {state.scanAmount}</div>
            </div>
            {state.scanDeductible && (
              <div className="tag tag-tax" style={{ alignSelf: 'flex-start', marginTop: 6 }}>Tax deductible</div>
            )}
          </div>

          {state.scanDeductible && (
            <button
              type="button"
              onClick={actions.viewInTax}
              className="pressable"
              style={{ width: '100%', textAlign: 'left', background: 'var(--color-tax-100)', border: '1.5px solid var(--color-tax-300)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxSizing: 'border-box' }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-tax-800)' }}>Added to your {taxYearLabel} deductions</div>
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
      )}
    </div>
  );
}
