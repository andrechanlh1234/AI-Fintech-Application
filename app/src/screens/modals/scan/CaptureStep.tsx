import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BottomSheet } from '../../../components/BottomSheet';

// `torch` is a real, widely-implemented MediaTrack capability/constraint
// (Chrome/Android, most non-Safari mobile browsers) but isn't in
// TypeScript's DOM lib types -- these two narrow it onto the standard
// shapes rather than casting to `any` at every call site.
interface TorchCapabilities extends MediaTrackCapabilities { torch?: boolean }
interface TorchConstraintSet extends MediaTrackConstraintSet { torch?: boolean }
interface FocusConstraintSet extends MediaTrackConstraintSet { focusMode?: string }

// Back camera at 1080p with continuous autofocus. Deliberately NOT 4K:
// asking the sensor for 3840x2160 makes the stream take noticeably longer
// to start on a phone (the camera renegotiates a high-res pipeline), which
// is the lag/"glitch" when the viewfinder opens. 1080p starts fast and is
// still well past what receipt OCR needs. `ideal` (not `exact`) so a
// device that can't hit these still returns its best stream rather than
// failing; `advanced` is best-effort and never causes a rejection.
const HD_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: 'environment' },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30 },
  advanced: [{ focusMode: 'continuous' } as FocusConstraintSet],
};

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
    if (!navigator.mediaDevices?.getUserMedia) return;

    navigator.mediaDevices.getUserMedia({ video: HD_VIDEO_CONSTRAINTS })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        // `liveCameraReady` is flipped by the <video>'s own onPlaying
        // handler, not here — so the fade-in reveals an actual first
        // frame instead of cross-fading black-to-black and then popping.
        // (No follow-up applyConstraints() either: renegotiating the
        // stream right after it goes live drops a black frame.)
        // Torch is device/browser-dependent (notably absent on iOS Safari,
        // even inside a PWA) -- only show the flash button where the
        // active track actually reports the capability.
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

  const captureFromLiveVideo = async () => {
    // Prefer a true full-resolution still from the camera hardware
    // (ImageCapture.takePhoto) — it can exceed the live preview stream's
    // resolution. Not available in every engine (notably iOS WKWebView as
    // of iOS 17), so fall back to a frame grab at the stream's native size.
    const track = streamRef.current?.getVideoTracks()[0];
    const ImageCaptureCtor = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture;
    if (track && ImageCaptureCtor) {
      try {
        const blob = await new ImageCaptureCtor(track).takePhoto();
        onCaptured(new File([blob], 'receipt.jpg', { type: blob.type || 'image/jpeg' }));
        return;
      } catch { /* fall through to the canvas grab */ }
    }

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
    }, 'image/jpeg', 0.95);
  };

  const handleCaptureClick = () => {
    if (liveCameraReady) captureFromLiveVideo();
    else fileInputRef.current?.click();
  };

  const circleBtn: CSSProperties = {
    width: 52, height: 52, borderRadius: '50%', border: 'none', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    background: 'rgba(20,20,20,0.42)', WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)', color: '#fff',
  };

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: '100dvh', overflow: 'hidden', background: '#0b0c0b' }}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onPlaying={() => setLiveCameraReady(true)}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          opacity: liveCameraReady ? 1 : 0, transition: 'opacity .3s ease-out',
        }}
      />

      {/* Header — a transparent overlay so the camera fills the screen right
          up behind the status bar / Dynamic Island. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top) + 6px) 14px 8px' }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="pressable"
          style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: '#fff', display: 'flex' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span style={{ font: '700 16px var(--font-heading)', color: '#fff', letterSpacing: '0.01em', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>Add expense</span>
        <div style={{ width: 36 }} />
      </div>

      {/* Placement guide: four rounded corner marks only — no frame outline,
          no dim. The capture always grabs the full camera frame. */}
      <div style={{ position: 'absolute', top: '13%', bottom: '27%', left: '8%', right: '8%', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 38, height: 38, borderTop: '3px solid #fff', borderLeft: '3px solid #fff', borderRadius: '16px 0 0 0' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 38, height: 38, borderTop: '3px solid #fff', borderRight: '3px solid #fff', borderRadius: '0 16px 0 0' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 38, height: 38, borderBottom: '3px solid #fff', borderLeft: '3px solid #fff', borderRadius: '0 0 0 16px' }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 38, height: 38, borderBottom: '3px solid #fff', borderRight: '3px solid #fff', borderRadius: '0 0 16px 0' }} />
      </div>

      {!liveCameraReady && (
        <div style={{ position: 'absolute', top: '46%', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.6)', font: '500 13px var(--font-body)', pointerEvents: 'none' }}>
          Starting camera…
        </div>
      )}

      {/* Scope note — kept well above the capture controls. */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '60%', display: 'flex', justifyContent: 'center', padding: '0 20px', pointerEvents: 'none' }}>
        <span style={{ background: 'rgba(255,255,255,0.94)', color: '#1a1c1a', font: '600 13px var(--font-body)', padding: '6px 14px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 12px rgba(0,0,0,0.22)' }}>
          <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>🇲🇾</span>
          Malaysian receipts only
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onCaptured(f); }}
      />
      <input
        ref={importFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onCaptured(f); }}
      />

      {/* Capture row */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom) + 92px)', zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
        <button
          type="button"
          onClick={() => importFileInputRef.current?.click()}
          aria-label="Choose from photos"
          className="pressable"
          style={circleBtn}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
        </button>
        <button
          type="button"
          onClick={handleCaptureClick}
          aria-label="Capture"
          className="pressable"
          style={{
            width: 76, height: 76, padding: 0, borderRadius: '50%', background: 'transparent',
            border: '4px solid #fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxSizing: 'border-box', flexShrink: 0, boxShadow: '0 2px 14px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#fff', flexShrink: 0 }} />
        </button>
        {torchSupported ? (
          <button
            type="button"
            onClick={toggleTorch}
            aria-label={torchOn ? 'Turn off flash' : 'Turn on flash'}
            className="pressable"
            style={{ ...circleBtn, background: torchOn ? '#fff' : circleBtn.background, color: torchOn ? '#0f100f' : '#fff' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>
          </button>
        ) : (
          <div style={{ width: 52, height: 52, flexShrink: 0 }} />
        )}
      </div>

      {/* "More ways to add expense" — pinned peeking sheet. No `.pressable`
          here on purpose: a scale(0.97) on a full-bleed left:0/right:0 bar
          pulls its edges in on tap and flashes a seam down the side. The
          sheet sliding up is the feedback; a light active fill is enough. */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="sheet-peek-trigger"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 6,
          background: 'var(--color-bg)', border: 'none', borderRadius: '20px 20px 0 0',
          padding: '11px 0 calc(env(safe-area-inset-bottom) + 14px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.18)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6" /></svg>
        <span style={{ font: '600 14px var(--font-body)', color: 'var(--color-text-muted)' }}>More ways to add expense</span>
      </button>

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)} recede={false}>
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
            <span style={{ font: '600 15px var(--font-body)', color: 'var(--color-text)' }}>Choose from Photos or Files</span>
          </button>
          <button
            type="button"
            onClick={() => { setPickerOpen(false); onManual(); }}
            className="pressable"
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', width: '100%', boxSizing: 'border-box' }}
          >
            <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-accent-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-800)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            </span>
            <span style={{ font: '600 15px var(--font-body)', color: 'var(--color-text)' }}>Enter details manually</span>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
