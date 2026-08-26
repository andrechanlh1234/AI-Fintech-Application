import { useRef, useState } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
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

  const handleClose = () => {
    clearCaptured();
    actions.closeScan();
  };

  const handleScanAnother = () => {
    clearCaptured();
    actions.scanAnother();
  };

  if (!state.scanOpen) return null;

  return (
    <div
      className="screen-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 40, background: 'var(--color-bg)',
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
