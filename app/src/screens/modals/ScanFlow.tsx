import { useEffect, useRef, useState } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { prefersReducedMotion } from '../../lib/motion';
import { CaptureStep } from './scan/CaptureStep';
import { PreviewStep } from './scan/PreviewStep';
import { ProcessingStep } from './scan/ProcessingStep';
import { UnableToScanStep } from './scan/UnableToScanStep';
import { ReviewStep } from './scan/ReviewStep';
import { SavedStep } from './scan/SavedStep';

interface PendingPhoto { file: File; url: string }

export function ScanFlow() {
  const { state } = useStore();
  const actions = useActions();
  const pendingPhotoRef = useRef<PendingPhoto | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);

  // A captured-but-not-yet-submitted photo lives here (local state), not in
  // the reducer -- keeps a non-serializable File/object-URL out of store
  // state that reducer.test.ts exercises with plain-object equality, and
  // matches how the live-camera stream itself is handled (CaptureStep's
  // own refs). Revoking the previous object URL whenever a new one lands,
  // or the flow leaves this photo behind, avoids leaking one per receipt
  // scanned in a session.
  const setCaptured = (file: File) => {
    if (pendingPhotoRef.current) URL.revokeObjectURL(pendingPhotoRef.current.url);
    const next = { file, url: URL.createObjectURL(file) };
    pendingPhotoRef.current = next;
    setPendingPhoto(next);
    actions.previewCapturedPhoto();
  };

  const clearCaptured = () => {
    if (pendingPhotoRef.current) URL.revokeObjectURL(pendingPhotoRef.current.url);
    pendingPhotoRef.current = null;
    setPendingPhoto(null);
  };

  const handleSnapAgain = () => {
    clearCaptured();
    actions.retakePhoto();
  };

  const handleContinue = () => {
    if (pendingPhoto) actions.capturePhotoFile(pendingPhoto.file);
  };

  // Close (X / back): let closeScan() flip scanOpen so the exit animation
  // plays; the pending photo is released after it finishes (see the effect
  // below), not synchronously -- clearing it now would yank the preview
  // image out mid-fade.
  const handleClose = () => {
    actions.closeScan();
  };

  const handleScanAnother = () => {
    clearCaptured();
    actions.scanAnother();
  };

  // Keep the flow mounted for a beat after scanOpen goes false so closing
  // animates out instead of vanishing instantly. Enter is derived during
  // render; exit is a timeout. Mirrors components/BottomSheet.tsx.
  const [rendered, setRendered] = useState(state.scanOpen);
  if (state.scanOpen && !rendered) setRendered(true);
  const closing = rendered && !state.scanOpen;

  useEffect(() => {
    if (!closing) return;
    const ms = prefersReducedMotion() ? 120 : 300;
    const t = setTimeout(() => { setRendered(false); clearCaptured(); }, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  if (!rendered) return null;

  // On the capture step the surface is the near-black camera view -- paint
  // the container that colour from the first frame so there's no light
  // flash between the app and the viewfinder appearing.
  const onCaptureStep = state.scanStep === 'capture';

  return (
    <div
      className={`screen-in${closing ? ' scan-out' : ''}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 40,
        background: onCaptureStep ? '#0b0c0b' : 'var(--color-bg)',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      }}
    >
      {state.scanStep === 'capture' && (
        <CaptureStep onClose={handleClose} onManual={actions.chooseManual} onCaptured={setCaptured} />
      )}
      {state.scanStep === 'preview' && pendingPhoto && (
        <PreviewStep photoUrl={pendingPhoto.url} onSnapAgain={handleSnapAgain} onContinue={handleContinue} />
      )}
      {state.scanStep === 'processing' && (
        <ProcessingStep photoUrl={pendingPhoto?.url ?? null} />
      )}
      {state.scanStep === 'unable' && (
        <UnableToScanStep onSnapAgain={handleSnapAgain} onAddCustomAmount={actions.chooseManual} />
      )}
      {state.scanStep === 'review' && (
        <ReviewStep onClose={handleClose} onImportPhoto={setCaptured} photoUrl={pendingPhoto?.url ?? null} />
      )}
      {state.scanStep === 'saved' && <SavedStep onScanAnother={handleScanAnother} />}
    </div>
  );
}
