import { useEffect, useRef, useState } from 'react';
import type { Quad } from './homography';

type OverlayPhoto = { name: string; url: string; width: number; height: number; points: Quad | null };

type Props = {
  previous?: OverlayPhoto;
  busy: boolean;
  onCapture: (file: File) => Promise<void>;
};

export default function CameraCapture({ previous, busy, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ownedStreams = useRef(new Set<MediaStream>());
  const requestRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [showPrevious, setShowPrevious] = useState(true);
  const [opacity, setOpacity] = useState(30);
  const [size, setSize] = useState({ width: 3, height: 4 });
  const [message, setMessage] = useState('');

  function stopCamera() {
    requestRef.current++;
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (streamRef.current) ownedStreams.current.delete(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setReady(false);
    setOpen(false);
  }

  useEffect(() => {
    const streams = ownedStreams.current;
    const requests = requestRef;
    const onHidden = () => { if (document.hidden) stopCamera(); };
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      requests.current++;
      for (const stream of streams) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  async function startCamera() {
    setMessage('');
    setOpen(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Live camera is unavailable here. Open Liike over HTTPS on your iPhone, or choose photos from your device.');
      return;
    }
    const request = ++requestRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 },
      } });
      if (request !== requestRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const video = videoRef.current;
      if (!video) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      ownedStreams.current.add(stream);
      video.srcObject = stream;
      await video.play();
    } catch (error) {
      if (request !== requestRef.current) return;
      setMessage(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Allow camera access in the browser to take photos here.'
        : 'Could not start the camera. You can still choose photos from your device.');
      streamRef.current?.getTracks().forEach(track => track.stop());
      if (streamRef.current) ownedStreams.current.delete(streamRef.current);
      streamRef.current = null;
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!ready || !video || busy || capturing || !video.videoWidth || !video.videoHeight) return;
    setCapturing(true);
    setMessage('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable.');
      // Capture the camera stream only; the translucent previous photo is a viewfinder guide.
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Photo capture failed.')), 'image/jpeg', .95));
      const name = `liike-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
      await onCapture(new File([blob], name, { type: 'image/jpeg' }));
      setMessage('Photo added. Align the next shot with the translucent image.');
    } catch {
      setMessage('Could not take this photo. Try again or choose a photo from your device.');
    } finally { setCapturing(false); }
  }

  const points = previous?.points;
  return <section className="camera-capture" aria-label="Camera capture">
    <div className="camera-heading"><div><p className="eyebrow">Camera experiment</p><h2>Line up the next shot</h2><p className="hint">Use the last photo as a translucent guide while taking the next one.</p></div>
      <button className="secondary" type="button" onClick={open ? stopCamera : () => { void startCamera(); }}>{open ? 'Close camera' : 'Open camera'}</button>
    </div>
    {open && <>
      <div className="camera-stage" style={{ aspectRatio: `${size.width} / ${size.height}` }}>
        <video ref={videoRef} autoPlay muted playsInline onPlaying={() => setReady(true)} onLoadedMetadata={event => {
          const video = event.currentTarget;
          if (video.videoWidth && video.videoHeight) setSize({ width: video.videoWidth, height: video.videoHeight });
        }} aria-label="Live camera preview" />
        {previous && showPrevious && <img className="camera-previous" src={previous.url} alt="Previous photo alignment overlay" style={{ opacity: opacity / 100 }} />}
        {previous && showPrevious && points && <svg className="camera-markers" viewBox={`0 0 ${previous.width} ${previous.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <polygon points={points.map(point => `${point!.x},${point!.y}`).join(' ')} />
          {points.map((point, index) => <circle key={index} cx={point!.x} cy={point!.y} r={Math.max(previous.width, previous.height) * .008} />)}
        </svg>}
        <div className="camera-grid" aria-hidden="true" />
        {!ready && <p className="camera-wait">{message || 'Starting camera…'}</p>}
      </div>
      <div className="camera-controls">
        <button className="primary camera-shutter" type="button" disabled={!ready || busy || capturing} onClick={() => { void capture(); }}>{capturing ? 'Adding photo…' : 'Take photo'}</button>
        <label className="checkbox"><input type="checkbox" checked={showPrevious} disabled={!previous} onChange={event => setShowPrevious(event.target.checked)} />Show previous photo</label>
        <label className="camera-opacity"><span>Previous photo · {opacity}%</span><input type="range" min="0" max="70" step="5" value={opacity} disabled={!previous || !showPrevious} onChange={event => setOpacity(Number(event.target.value))} /></label>
      </div>
      <p className="hint camera-note">{previous ? `Guide: ${previous.name}. The overlay and grid are not saved in the photo.` : 'Take the first photo to enable the previous photo overlay.'} {ready && `${size.width} × ${size.height} px camera stream.`} Keep this page open until you export the animation.</p>
      <p className="hint camera-note">Liike currently aligns receipt L marks when making the animation, so deliberate camera moves and zooms are straightened out in the export.</p>
      {message && ready && <p className="camera-message" role="status">{message}</p>}
    </>}
  </section>;
}
