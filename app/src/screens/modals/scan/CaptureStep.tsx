import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../../../components/BottomSheet';

// `torch` is a real, widely-implemented MediaTrack capability/constraint
// (Chrome/Android, most non-Safari mobile browsers) but isn't in
// TypeScript's DOM lib types -- these two narrow it onto the standard
// shapes rather than casting to `any` at every call site.
interface TorchCapabilities extends MediaTrackCapabilities { torch?: boolean }
interface TorchConstraintSet extends MediaTrackConstraintSet { torch?: boolean }

export function CaptureStep({ onClose, onManual, onCaptured }: {
  onClose: () => void;
  onManual: () => void;
  onCaptured: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [liveCameraReady, setLiveCameraReady] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // A real live viewfinder, not just a decorative frame — matches what
  // "Align the receipt within the frame" actually implies. getUserMedia
  // only works in a secure context (https, or localhost) though, so this
  // quietly falls back to the native camera-app picker (the file input
  // below, which has no such restriction) wherever it isn't available —
  // e.g. testing over a plain-http LAN IP from a phone.
  useEffect(() => {
    let cancelled = false;
    setLiveCameraReady(false);
    setTorchSupported(false);
    setTorchOn(false);

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
        // Torch is device/browser-dependent (notably absent on iOS Safari,
        // even inside a PWA) -- only show the flash button where the
        // active track actually reports the capability, rather than
        // rendering a control that would silently do nothing.
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as TorchCapabilities | undefined;
        if (caps?.torch) setTorchSupported(true);
      })
      .catch(() => { /* permission denied / no camera — fall back to the file input */ });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const toggleTorch = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    track.applyConstraints({ advanced: [{ torch: next } as TorchConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => { /* capability changed mid-session / constraint rejected — leave state as-is */ });
  };

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
      if (blob) onCaptured(new File([blob], 'receipt.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  const handleCaptureClick = () => {
    if (liveCameraReady) captureFromLiveVideo();
    else fileInputRef.current?.click();
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg,#2a2c2b,#0f100f)', position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', position: 'relative', zIndex: 5 }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="pressable"
          style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
        </button>
        <span style={{ font: '600 13px var(--font-body)', color: 'rgba(255,255,255,0.85)', letterSpacing: '0.02em' }}>Add expense</span>
        {/* Balances the close button so the title stays centered. */}
        <div style={{ width: 36, height: 36 }} />
      </div>
      {/* Full-bleed viewfinder: the video fills the entire remaining screen
          area edge-to-edge (no margin, no clipping radius), matching a real
          camera app. The corner-bracket "frame" is a separate, purely
          decorative overlay inset from the true edges -- it used to share
          this same margined/clipped box as the video itself, which is what
          was shrinking the live feed down to a rounded rectangle instead of
          filling the screen. */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
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
        <div style={{ position: 'absolute', inset: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {/* Thinner, more rounded corner brackets than before -- a subtler
              frame, matching the reference rather than a bold viewfinder. */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTop: '2px solid rgba(255,255,255,0.75)', borderLeft: '2px solid rgba(255,255,255,0.75)', borderRadius: '10px 0 0 0' }} />
          <div style={{ position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTop: '2px solid rgba(255,255,255,0.75)', borderRight: '2px solid rgba(255,255,255,0.75)', borderRadius: '0 10px 0 0' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottom: '2px solid rgba(255,255,255,0.75)', borderLeft: '2px solid rgba(255,255,255,0.75)', borderRadius: '0 0 0 10px' }} />
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottom: '2px solid rgba(255,255,255,0.75)', borderRight: '2px solid rgba(255,255,255,0.75)', borderRadius: '0 0 10px 0' }} />
          {!liveCameraReady && (
            <span style={{ font: '500 13px var(--font-body)', color: 'rgba(255,255,255,0.55)', position: 'relative' }}>
              Align the receipt within the frame
            </span>
          )}
        </div>
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
            if (file) onCaptured(file);
          }}
        />
        <input
          ref={importFileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onCaptured(file);
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, width: '100%' }}>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="Choose a photo or file"
            className="pressable"
            style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
          </button>
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
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fff', flexShrink: 0 }} />
          </button>
          {torchSupported ? (
            <button
              type="button"
              onClick={toggleTorch}
              aria-label={torchOn ? 'Turn off flash' : 'Turn on flash'}
              className="pressable"
              style={{ width: 44, height: 44, borderRadius: '50%', background: torchOn ? '#fff' : 'rgba(255,255,255,0.12)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: torchOn ? '#0f100f' : '#fff', flexShrink: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>
            </button>
          ) : (
            // Keeps the capture button centered whether or not flash is available.
            <div style={{ width: 44, height: 44, flexShrink: 0 }} />
          )}
        </div>
        <button
          type="button"
          onClick={onManual}
          className="pressable"
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', font: '600 13px var(--font-body)', cursor: 'pointer' }}
        >
          Enter details manually instead
        </button>
      </div>

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <div style={{ padding: '10px 8px 24px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-neutral-300)', margin: '4px auto 18px' }} />
          <button
            type="button"
            onClick={() => { setPickerOpen(false); importFileInputRef.current?.click(); }}
            className="pressable"
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', width: '100%', boxSizing: 'border-box' }}
          >
            <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-accent-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-800)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
            </span>
            <span style={{ font: '600 15px var(--font-body)', color: 'var(--color-text)' }}>Photo</span>
          </button>
          <button
            type="button"
            onClick={() => { setPickerOpen(false); importFileInputRef.current?.click(); }}
            className="pressable"
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', width: '100%', boxSizing: 'border-box' }}
          >
            <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-accent-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-800)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>
            </span>
            <span style={{ font: '600 15px var(--font-body)', color: 'var(--color-text)' }}>File</span>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
