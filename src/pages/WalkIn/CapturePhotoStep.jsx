import React, { useEffect, useRef, useState } from 'react';
import { Camera, Upload, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { blobToDataUrl, isWebcamAvailable } from '../../utils/walkInHelpers';

/**
 * CapturePhotoStep — Step 2 of the Walk-In wizard.
 *
 * Webcam primary (deferred permission — only prompts on "Use Webcam"
 * click). Upload fallback available unconditionally. Skip link
 * always visible. Captured photo is stored as a base64 data URL
 * on visitor.photoDataUrl.
 *
 * Permission UX per product decision:
 *   • "Use Webcam" button triggers getUserMedia. If granted, video
 *     preview shows with "Capture" + "Cancel" buttons.
 *   • If denied or API unavailable, webcam block collapses to a
 *     helper message and the upload fallback remains.
 *   • Skip link copy: "Skip photo capture" (plain link, not button).
 */

/* TODO Backend Migration — replace base64 data URL with blob upload
   to S3/Cloudinary. Base64 storage works for the mock at roughly
   30KB per photo but scales poorly beyond ~1000 visitors per org
   (localStorage quota is 5-10MB). */

const VIDEO_CONSTRAINTS = {
  video: {
    width:  { ideal: 640 },
    height: { ideal: 480 },
    facingMode: 'user',
  },
  audio: false,
};

const JPEG_QUALITY = 0.7;

export default function CapturePhotoStep({ form, setField }) {
  const formPhoto = form.visitor?.photoDataUrl || '';

  /* Bug 2 fix: keep a local copy of the captured photo so the preview is
     guaranteed to render even if the parent's setField path-update has
     a stale-closure or shape mismatch. The source of truth on save is
     still form.visitor.photoDataUrl. */
  const [localPhoto, setLocalPhoto] = useState(formPhoto);
  const photo = localPhoto || formPhoto;

  const [mode, setMode]       = useState(formPhoto ? 'preview' : 'idle'); /* 'idle' | 'live' | 'error' | 'preview' */
  const [errorMsg, setError]  = useState('');
  const [starting, setStart]  = useState(false);
  const [uploading, setUpload] = useState(false);
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const webcamOk  = isWebcamAvailable();

  /* Keep local mirror in sync if parent updates the form externally. */
  useEffect(() => { setLocalPhoto(formPhoto); }, [formPhoto]);

  /* Clean up any active camera stream when the step unmounts. */
  useEffect(() => () => stopStream(), []);

  /* Bug 2 fix: assign srcObject AFTER the <video> element has rendered
     in 'live' mode. Previously startWebcam tried to set srcObject before
     the element existed in the DOM, so the preview was never attached
     reliably. */
  useEffect(() => {
    if (mode !== 'live') return;
    const v = videoRef.current;
    const s = streamRef.current;
    if (!v || !s) return;
    try {
      v.srcObject = s;
      const playPromise = v.play();
      if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
    } catch (err) {
      console.error('[CapturePhotoStep] failed to attach stream:', err);
    }
  }, [mode]);

  const stopStream = () => {
    try {
      const s = streamRef.current;
      if (s) {
        s.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      }
    } catch {}
    streamRef.current = null;
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch {}
    }
  };

  const startWebcam = async () => {
    if (!webcamOk || starting) return;
    setError('');
    setStart(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
      streamRef.current = stream;
      /* Render the <video> first; useEffect above will attach srcObject. */
      setMode('live');
    } catch (err) {
      console.error('[CapturePhotoStep] getUserMedia failed:', err);
      setMode('error');
      setError(err?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Use the upload option or skip this step.'
        : 'Camera is unavailable. Use the upload option or skip this step.');
    } finally {
      setStart(false);
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      console.warn('[CapturePhotoStep] capture aborted — missing video/canvas ref');
      return;
    }
    const w = video.videoWidth  || 640;
    const h = video.videoHeight || 480;
    if (!video.videoWidth || !video.videoHeight) {
      console.warn('[CapturePhotoStep] video metadata not ready, capturing fallback size');
    }
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    try {
      ctx.drawImage(video, 0, 0, w, h);
    } catch (err) {
      console.error('[CapturePhotoStep] drawImage failed:', err);
      setError('Could not capture frame. Please try again.');
      return;
    }
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    if (!dataUrl || dataUrl.length < 100) {
      console.error('[CapturePhotoStep] empty data URL produced');
      setError('Capture produced an empty image. Please try again.');
      return;
    }
    /* Persist into local AND parent state — local guarantees render. */
    setLocalPhoto(dataUrl);
    setField('visitor.photoDataUrl', dataUrl);
    stopStream();
    setMode('preview');
  };

  const cancelLive = () => {
    stopStream();
    setMode('idle');
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpload(true);
    setError('');
    try {
      /* Quick size guard — 2MB max before dataURL conversion. */
      if (file.size > 2 * 1024 * 1024) {
        setError('Photo file is too large. Please choose a photo under 2 MB or use the webcam.');
        setUpload(false);
        return;
      }
      const dataUrl = await blobToDataUrl(file);
      setLocalPhoto(dataUrl);
      setField('visitor.photoDataUrl', dataUrl);
      setMode('preview');
    } catch (err) {
      console.error('[CapturePhotoStep] upload read failed:', err);
      setError('Could not read the selected photo. Please try again.');
    } finally {
      setUpload(false);
    }
  };

  const retake = () => {
    setLocalPhoto('');
    setField('visitor.photoDataUrl', '');
    setMode('idle');
  };

  const skip = () => {
    stopStream();
    setLocalPhoto('');
    setField('visitor.photoDataUrl', '');
    setMode('idle');
  };

  const showPreview = photo && (mode === 'preview' || mode === 'idle');

  return (
    <div>
      <p className="mb-4 text-[13px] text-slate-600 dark:text-slate-300">
        Capture a photo of the visitor using your webcam, upload one, or skip if not required.
      </p>

      {/* Preview */}
      {showPreview && (
        <div className="mb-4 flex flex-col items-center gap-3 rounded-[12px] border border-slate-200 bg-slate-50 p-4 dark:border-[#142535] dark:bg-[#071220]">
          <img
            src={photo}
            alt="Captured visitor"
            style={{ display: 'block', maxWidth: '100%', maxHeight: 320, width: 'auto' }}
            className="rounded-[8px] border border-slate-200 object-cover dark:border-[#142535]"
          />
          <div className="text-center">
            <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-emerald-700 dark:text-emerald-300">
              ✓ Photo captured
            </p>
            <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">
              This image will be stamped on the visitor badge.
            </p>
            <button
              type="button" onClick={retake}
              className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200">
              <RotateCcw size={12} aria-hidden="true" /> Retake
            </button>
          </div>
        </div>
      )}

      {/* Webcam panel */}
      {!showPreview && webcamOk && mode !== 'error' && (
        <div className="rounded-[12px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
          {mode === 'idle' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Camera size={48} aria-hidden="true" strokeWidth={1.5} className="text-sky-500 dark:text-sky-300" />
              <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                Use the webcam to capture the visitor&rsquo;s photo.
              </p>
              <button
                type="button" onClick={startWebcam} disabled={starting}
                className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2 text-[13px] font-bold text-white hover:from-sky-700 hover:to-sky-900 disabled:opacity-40">
                {starting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                {starting ? 'Starting camera…' : 'Use Webcam'}
              </button>
              <p className="text-[11px] text-slate-400">
                You&rsquo;ll be asked for camera permission when the camera starts.
              </p>
            </div>
          )}

          {mode === 'live' && (
            <div className="flex flex-col items-center gap-3 py-2">
              <video
                ref={videoRef}
                playsInline muted autoPlay
                className="h-auto w-full max-w-[480px] rounded-[10px] bg-black"
              />
              <div className="flex gap-2">
                <button type="button" onClick={captureFrame}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-sky-700 px-5 py-2 text-[13px] font-bold text-white hover:bg-sky-800">
                  <Camera size={14} aria-hidden="true" /> Capture
                </button>
                <button type="button" onClick={cancelLive}
                  className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Webcam error / unavailable → upload fallback */}
      {(!showPreview && (mode === 'error' || !webcamOk)) && (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
            <p className="text-[12px] text-amber-800 dark:text-amber-200">
              {errorMsg || 'Webcam unavailable. Upload a photo or skip this step.'}
            </p>
          </div>
        </div>
      )}

      {/* Upload fallback always available */}
      <div className="mt-3">
        <label htmlFor="walkin-photo-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200">
          {uploading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
          {uploading ? 'Uploading…' : 'Upload Photo'}
        </label>
        <input
          id="walkin-photo-upload" type="file" accept="image/*" capture="user"
          disabled={uploading}
          className="sr-only"
          onChange={onUpload}
        />
      </div>

      {/* Skip link — plain, always visible, not prominent. */}
      <div className="mt-4 text-center">
        <button type="button" onClick={skip}
          className="cursor-pointer text-[12px] font-semibold text-slate-500 underline-offset-2 hover:text-sky-700 hover:underline dark:text-slate-400 dark:hover:text-sky-300">
          Skip photo capture
        </button>
      </div>

      {/* Hidden canvas used for frame capture. */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
}
