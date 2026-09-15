import { MAX_FRAME_NUMBER, validFrameNumber } from './frame-number';
import type { Photo } from './photos';

export default function FrameNumberField({ photo, setNumber, disabled = false }: { photo: Photo; setNumber: (id: string, number: number | undefined) => void; disabled?: boolean }) {
  return <label className="field frame-number-field"><span>Frame number on paper</span><input type="number" inputMode="numeric" min={1} max={MAX_FRAME_NUMBER} step={1} placeholder="Not set" value={photo.frameNumber ?? ''} disabled={disabled} onChange={event => {
    if (event.target.value === '') setNumber(photo.id, undefined);
    else if (validFrameNumber(event.target.valueAsNumber)) setNumber(photo.id, event.target.valueAsNumber);
  }} /></label>;
}
