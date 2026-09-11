import { timelineFrames } from './sequence.ts';
import type { SequenceSettings } from './sequence';
import type { ExtractedFrame } from './frames';

export type ExportFormat = 'gif' | 'video' | 'png';
export type ExportOptions = { format: ExportFormat; longSide: number; dither: boolean; loops: number; quality: 'Standard' | 'High'; videoFormat: 'auto' | 'webm' };
export const DEFAULT_EXPORT: ExportOptions = { format: 'gif', longSide: 0, dither: false, loops: 4, quality: 'High', videoFormat: 'auto' };
export type ExportPlan = {
  frames: ExtractedFrame[]; fps: number; loop: boolean; width: number; height: number; contentWidth: number; contentHeight: number;
  options: ExportOptions; frameCount: number; duration: number;
};

export function buildExportPlan(frames: ExtractedFrame[], sequence: SequenceSettings, options: ExportOptions): ExportPlan {
  const timeline = timelineFrames(frames, sequence);
  if (!timeline.length) throw new Error('Include at least one frame in Sequence before exporting.');
  if (!Number.isInteger(sequence.fps) || sequence.fps < 1 || sequence.fps > 30) throw new Error('Choose a speed from 1 to 30 fps.');
  if (!['gif', 'video', 'png'].includes(options.format) || !['Standard', 'High'].includes(options.quality) || !['auto', 'webm'].includes(options.videoFormat)) throw new Error('Choose a supported export format.');
  if (options.format === 'video' && (!Number.isInteger(options.loops) || options.loops < 1 || options.loops > 20)) throw new Error('Choose 1–20 video repeats.');
  const first = timeline[0]!;
  if (timeline.some(f => f.width !== first.width || f.height !== first.height || f.width < 1 || f.height < 1)) throw new Error('Extract all frames again at the same resolution.');
  if (!Number.isInteger(options.longSide) || options.longSide < 0 || options.longSide > 2160 || (options.longSide !== 0 && options.longSide < 64)) throw new Error('Choose a valid export size.');
  const scale = options.longSide ? Math.min(1, options.longSide / Math.max(first.width, first.height)) : 1;
  const contentWidth = Math.max(1, Math.round(first.width * scale)), contentHeight = Math.max(1, Math.round(first.height * scale));
  // Pad an odd edge by one pixel for video; never stretch or clip the drawing.
  const width = options.format === 'video' ? Math.ceil(contentWidth / 2) * 2 : contentWidth;
  const height = options.format === 'video' ? Math.ceil(contentHeight / 2) * 2 : contentHeight;
  const frameCount = timeline.length * (options.format === 'video' ? options.loops : 1);
  return { frames: timeline, fps: sequence.fps, loop: sequence.loop, width, height, contentWidth, contentHeight, options, frameCount, duration: frameCount / sequence.fps };
}

export function frameTiming(index: number, fps: number) {
  const timestamp = Math.round(index * 1_000_000 / fps);
  return { timestamp, duration: Math.round((index + 1) * 1_000_000 / fps) - timestamp };
}
export const gifDelay = (index: number, fps: number) => (Math.round((index + 1) * 100 / fps) - Math.round(index * 100 / fps)) * 10;
export const pngName = (index: number) => `frames/frame-${String(index + 1).padStart(6, '0')}.png`;
export function exportManifest(plan: ExportPlan) {
  return { app: 'Liike', version: 1, timeUnit: 'microseconds', fps: plan.fps, loop: plan.loop, width: plan.width, height: plan.height, durationSeconds: plan.frames.length / plan.fps,
    frames: plan.frames.map((frame, i) => ({ file: pngName(i), sourceFrame: frame.frame + 1, sheet: frame.sheet + 1, stabilized: Boolean(frame.stabilized), ...frameTiming(i, plan.fps) })) };
}

export type VideoChoice = { format: 'mp4' | 'webm'; config: VideoEncoderConfig };
export async function chooseVideo(plan: Pick<ExportPlan, 'width' | 'height' | 'fps' | 'options'>, check: (config: VideoEncoderConfig) => Promise<boolean>): Promise<VideoChoice | null> {
  const { width, height, fps, options } = plan;
  const blocks = Math.ceil(width / 16) * Math.ceil(height / 16);
  const level = blocks <= 3600 && blocks * fps <= 108000 ? '1f' : blocks <= 8192 && blocks * fps <= 245760 ? '28' : '33';
  const bitrate = Math.round(Math.max(500000, Math.min(40000000, width * height * fps * (options.quality === 'High' ? .35 : .15))));
  const common = { width, height, framerate: fps, bitrate, latencyMode: 'realtime' as const };
  const choices: VideoChoice[] = [
    ...(options.videoFormat === 'auto' ? [{ format: 'mp4' as const, config: { ...common, codec: `avc1.4200${level}`, avc: { format: 'avc' as const } } }] : []),
    { format: 'webm', config: { ...common, codec: Math.max(width, height) > 1920 ? 'vp09.00.51.08' : 'vp09.00.41.08' } },
  ];
  for (const choice of choices) { try { if (await check(choice.config)) return choice; } catch { /* Try the next available codec. */ } }
  return null;
}
