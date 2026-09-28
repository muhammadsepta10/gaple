import { DURASI } from '../durasi';

const STORAGE_KEY = 'gaple.mute';
const SAMPLES = [
  'card-place-1', 'card-place-2', 'card-place-3', 'card-place-4',
  'question_001', 'impactPunch_heavy_001', 'glass_002', 'lowThreeTone',
  'powerUp9', 'powerUp12', 'chips-stack-1',
] as const;
type Sample = typeof SAMPLES[number];

function storedMute(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
  catch { return false; }
}

/** Context dibuat hanya setelah ketukan pengguna. Kegagalan storage/audio tidak menghentikan game. */
export class Suara {
  muted = storedMute();
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private buffers = new Map<Sample, AudioBuffer>();
  private loading = false;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  setMuted(value: boolean) {
    this.muted = value;
    if (this.output) this.output.gain.value = value ? 0 : 1;
    try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* storage bisa diblokir */ }
  }

  unlock() {
    if (!this.context) {
      try {
        this.context = new AudioContext();
        this.output = this.context.createGain();
        this.output.gain.value = this.muted ? 0 : 1;
        this.output.connect(this.context.destination);
      } catch { return; }
    }
    void this.context.resume().catch(() => {});
    if (this.loading) return;
    this.loading = true;
    for (const sample of SAMPLES) {
      void fetch(`${import.meta.env.BASE_URL}sfx/${sample}.m4a`)
        .then((response) => {
          if (!response.ok) throw new Error(`audio ${response.status}`);
          return response.arrayBuffer();
        })
        .then((data) => this.context?.decodeAudioData(data))
        .then((buffer) => { if (buffer) this.buffers.set(sample, buffer); })
        .catch(() => {});
    }
  }

  private sample(name: Sample, rate = 1) {
    const ctx = this.context;
    const buffer = this.buffers.get(name);
    if (this.muted || !ctx || ctx.state !== 'running' || !buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.connect(this.output ?? ctx.destination);
    source.start();
  }

  private later(ms: number, fn: () => void) {
    const timer = setTimeout(() => { this.timers.delete(timer); fn(); }, ms);
    this.timers.add(timer);
  }

  private tone(frequency: number, at: number, length: number, shape: OscillatorType = 'square', gain = 0.075) {
    const ctx = this.context;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    const oscillator = ctx.createOscillator();
    const volume = ctx.createGain();
    oscillator.type = shape;
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(0.001, at);
    volume.gain.exponentialRampToValueAtTime(gain, at + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.001, at + length);
    oscillator.connect(volume).connect(this.output ?? ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + length + 0.01);
  }

  /** Klik derau bandpass pendek per kartu dibagikan. */
  dealClick() {
    const ctx = this.context;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    const size = Math.floor(ctx.sampleRate * DURASI.klikBagi / 1000);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const volume = ctx.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = 2100;
    filter.Q.value = 0.8;
    volume.gain.value = 0.12;
    source.connect(filter).connect(volume).connect(this.output ?? ctx.destination);
    source.start();
  }

  cardLand() {
    const choice = (1 + Math.floor(Math.random() * 4)) as 1 | 2 | 3 | 4;
    this.sample(`card-place-${choice}`, 0.94 + Math.random() * 0.12);
  }
  pass() { this.sample('question_001'); }
  balak() {
    this.sample('impactPunch_heavy_001');
    this.sample('glass_002');
    this.later(DURASI.kacaUlang, () => this.sample('glass_002'));
  }
  winSession() {
    const ctx = this.context;
    if (!ctx) return;
    [261.63, 329.63, 392, 523.25].forEach((f, i) => this.tone(
      f,
      ctx.currentTime + i * DURASI.nadaFanfareJarak / 1000,
      (i === 3 ? DURASI.nadaFanfareAkhir : DURASI.nadaFanfare) / 1000,
    ));
  }
  gaplek() { this.sample('lowThreeTone'); }
  champion() {
    this.sample('powerUp9');
    this.later(DURASI.juaraPowerKedua, () => this.sample('powerUp12'));
    this.later(DURASI.juaraChip, () => this.sample('chips-stack-1'));
  }
  cancelPending() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }
  dispose() {
    this.cancelPending();
    void this.context?.close();
    this.context = null;
    this.output = null;
  }
}
