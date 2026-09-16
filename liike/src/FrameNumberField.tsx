import { MAX_FRAME_NUMBER, validFrameNumber } from './frame-number';
import type { Photo } from './photos';

export default function FrameNumberField({ photo, setNumber, readNumber, disabled = false }: { photo: Pick<Photo, 'id' | 'frameNumber' | 'numberDetection'>; setNumber: (id: string, number: number | undefined) => void; readNumber?: (id: string) => void; disabled?: boolean }) {
  const reading = photo.numberDetection;
  const message = reading?.status === 'found' && reading.value !== photo.frameNumber ? `Read ${reading.value}; kept your current number ${photo.frameNumber ?? 'unset'}. Use Read number to replace it.` : reading?.message;
  return <div className="frame-number-control"><label className="field frame-number-field"><span>Frame number on paper</span><input type="number" inputMode="numeric" min={1} max={MAX_FRAME_NUMBER} step={1} placeholder="Not set" value={photo.frameNumber ?? ''} disabled={disabled} onChange={event => {
    if (event.target.value === '') setNumber(photo.id, undefined);
    else if (validFrameNumber(event.target.valueAsNumber)) setNumber(photo.id, event.target.valueAsNumber);
  }} /></label>{readNumber && <button className="secondary" disabled={disabled || reading?.status === 'running'} onClick={() => readNumber(photo.id)}>{reading?.status === 'running' ? 'Reading number…' : 'Read number'}</button>}{message && <p className="hint" role="status">{message}</p>}</div>;
}
