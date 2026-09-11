import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from 'webm-muxer';
import { chooseVideo, frameTiming } from './export-plan';
import type { ExportPlan, VideoChoice } from './export-plan';
import { encodeGif } from './export-gif';
import type { ExportProgress } from './export-gif';
import { pngArchive } from './export-archive';
import { setWebmDuration } from './webm-duration';

export type ExportResult = { blob: Blob; format: 'gif' | 'mp4' | 'webm' | 'png'; width: number; height: number; duration: number; frames: number; note?: string };
export type ExportMessage = { type: 'progress'; progress: ExportProgress } | { type: 'result'; result: ExportResult } | { type: 'error'; message: string } | { type: 'support'; format: 'mp4' | 'webm' | null };
const supported = async (config: VideoEncoderConfig) => typeof VideoEncoder !== 'undefined' && (await VideoEncoder.isConfigSupported(config)).supported === true;
const progress = (value: ExportProgress) => self.postMessage({ type: 'progress', progress: value } satisfies ExportMessage);

self.onmessage = async (event: MessageEvent<{ type: 'probe' | 'export'; plan: ExportPlan }>) => {
  const { plan, type } = event.data;
  try {
    if (type === 'probe') { const choice = await chooseVideo(plan, supported); self.postMessage({ type: 'support', format: choice?.format ?? null } satisfies ExportMessage); return; }
    const canvas = new OffscreenCanvas(plan.width, plan.height), context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Image export is unavailable in this browser.');
    const readBlob = async (index: number) => {
      const url = plan.frames[index]!.url;
      if (!url.startsWith('blob:')) throw new Error('Extract the frames again before exporting.');
      const response = await fetch(url);
      if (!response.ok) throw new Error('A frame is no longer available. Extract it again.');
      return response.blob();
    };
    const draw = async (index: number) => {
      const bitmap = await createImageBitmap(await readBlob(index));
      try {
        context.fillStyle = '#fff'; context.fillRect(0, 0, plan.width, plan.height);
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
        context.drawImage(bitmap, 0, 0, plan.contentWidth, plan.contentHeight);
      } finally { bitmap.close(); }
    };
    let blob: Blob, format: ExportResult['format'] = plan.options.format === 'png' ? 'png' : 'gif', note: string | undefined;
    if (plan.options.format === 'gif') {
      blob = await encodeGif(plan, async i => { await draw(i); return context.getImageData(0, 0, plan.width, plan.height); }, progress);
    } else if (plan.options.format === 'png') {
      blob = await pngArchive(plan, async i => {
        if (plan.width === plan.frames[i]!.width && plan.height === plan.frames[i]!.height) return new Uint8Array(await (await readBlob(i)).arrayBuffer());
        await draw(i); return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
      }, done => progress({ phase: 'Packing PNG frames', done, total: plan.frames.length }));
    } else {
      const encode = async (choice: VideoChoice) => {
        const target = choice.format === 'mp4' ? new Mp4Target() : new WebmTarget();
        const muxer = choice.format === 'mp4'
          ? new Mp4Muxer({ target: target as Mp4Target, video: { codec: 'avc', width: plan.width, height: plan.height, frameRate: plan.fps }, fastStart: 'in-memory' })
          : new WebmMuxer({ target: target as WebmTarget, video: { codec: 'V_VP9', width: plan.width, height: plan.height, frameRate: plan.fps } });
        let failure: Error | null = null;
        const encoder = new VideoEncoder({ output: (chunk, metadata) => { try { muxer.addVideoChunk(chunk, metadata); } catch (error) { failure = error instanceof Error ? error : new Error('Could not assemble the video.'); } }, error: error => { failure = error; } });
        try {
          encoder.configure(choice.config);
          for (let i = 0; i < plan.frameCount; i++) {
            if (failure) throw failure;
            await draw(i % plan.frames.length);
            const frame = new VideoFrame(canvas, frameTiming(i, plan.fps));
            try { encoder.encode(frame, { keyFrame: i % Math.max(1, plan.fps * 2) === 0 }); } finally { frame.close(); }
            if (encoder.encodeQueueSize >= 4) await encoder.flush();
            progress({ phase: `Encoding ${choice.format === 'mp4' ? 'MP4' : 'WebM'}`, done: i + 1, total: plan.frameCount });
          }
          await encoder.flush(); if (failure) throw failure;
          muxer.finalize();
          if (choice.format === 'webm') setWebmDuration(target.buffer, plan.duration);
          return new Blob([target.buffer], { type: choice.format === 'mp4' ? 'video/mp4' : 'video/webm' });
        } finally { if (encoder.state !== 'closed') encoder.close(); }
      };
      let choice = await chooseVideo(plan, supported);
      if (!choice) throw new Error('Video export is unavailable at this size in this browser. Try a smaller size, or export GIF or PNG.');
      try { blob = await encode(choice); }
      catch (error) {
        if (choice.format !== 'mp4' || plan.options.videoFormat !== 'auto') throw error;
        const fallback = await chooseVideo({ ...plan, options: { ...plan.options, videoFormat: 'webm' } }, supported);
        if (!fallback) throw error;
        choice = fallback; blob = await encode(choice);
        note = 'MP4 encoding was unavailable. Your video was created as WebM instead.';
      }
      format = choice.format;
    }
    const duration = format === 'gif' ? Math.round(plan.frames.length * 100 / plan.fps) / 100 : plan.duration;
    self.postMessage({ type: 'result', result: { blob, format, width: plan.width, height: plan.height, duration, frames: plan.frameCount, note } } satisfies ExportMessage);
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Could not export this sequence. Try a smaller size.' } satisfies ExportMessage); }
};
