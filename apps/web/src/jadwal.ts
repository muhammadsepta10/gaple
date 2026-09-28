import { DURASI } from '@gaple/ruang';
import type { Suara } from './audio/suara';

export function wait(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      resolve(ok);
    };
    const abort = () => finish(false);
    const timer = setTimeout(() => finish(true), ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export function dealClicks(audio: Suara, signal: AbortSignal) {
  const timers = Array.from({ length: 28 }, (_, i) => setTimeout(() => {
    if (!signal.aborted) audio.dealClick();
  }, i * DURASI.jedaBagi));
  const cancel = () => timers.forEach(clearTimeout);
  signal.addEventListener('abort', cancel, { once: true });
  return () => { cancel(); signal.removeEventListener('abort', cancel); };
}
