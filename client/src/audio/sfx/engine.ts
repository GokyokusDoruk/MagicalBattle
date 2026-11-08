import type { Element } from '../../battle/damage/elements';
import { buildRecipe, recipeDuration, type FilterSpec, type Layer, type SoundName, type SoundOptions, type Sweep } from './recipes';

/** Aynı anda çalabilecek en fazla katman sayısı; telefonda ses yığılmasın. */
export const MAX_VOICES = 28;
const FLOOR = 0.0001; // üstel zarf sıfıra inemez

export interface DrawLoop {
  /** `speed`: kalem hızı, 0 (duruyor) - 1 (çok hızlı) */
  update(speed: number): void;
  end(): void;
}

const NO_DRAW: DrawLoop = { update: () => {}, end: () => {} };

const first = (s: Sweep): number => (typeof s === 'number' ? s : s[0]);
const last = (s: Sweep): number => (typeof s === 'number' ? s : s[1]);

function defaultFactory(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/** Çizerken kalem hızına göre değişen sürekli ses: elemente göre bir gürültü tonu. */
const DRAW_TONES: Record<Element, { freq: number; q: number; type: BiquadFilterType }> = {
  fire: { freq: 1800, q: 1.2, type: 'bandpass' },
  water: { freq: 900, q: 2.5, type: 'bandpass' },
  earth: { freq: 300, q: 0.8, type: 'lowpass' },
  air: { freq: 2600, q: 1.6, type: 'bandpass' },
};

/**
 * Ses motoru (WebAudio). Tarayıcılar sesi yalnızca kullanıcı etkileşiminden sonra açtığı için ilk dokunuşta
 * `unlock()` çağrılır; öncesinde `play` sessizce yok sayılır. Desteklenmeyen cihazda hiçbir şey yapmaz.
 * `AudioContext` dışarıdan verilebildiği için sahte bir bağlamla test edilir.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private volume = 0.6;
  private voices = 0;

  constructor(private readonly factory: () => AudioContext | null = defaultFactory) {}

  get isMuted(): boolean {
    return this.muted;
  }

  get currentVolume(): number {
    return this.volume;
  }

  get activeVoices(): number {
    return this.voices;
  }

  /** Ses bağlamını hazırlar ve (askıdaysa) devam ettirir. İlk kullanıcı dokunuşunda çağrılır. */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = this.factory();
      if (!this.ctx) return;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      // Üst üste binen sesler bozulmasın diye sıkıştırıcı
      const compressor = this.ctx.createDynamicsCompressor();
      this.master.connect(compressor);
      compressor.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : this.volume));
    this.applyVolume();
  }

  private applyVolume(): void {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
  }

  private get ready(): boolean {
    return this.ctx !== null && this.master !== null && !this.muted;
  }

  /** Sesi çalar. Sessizdeyse, bağlam hazır değilse ya da çok fazla ses varsa yok sayılır. */
  play(name: SoundName, options: SoundOptions = {}): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    if (ctx.state === 'suspended') void ctx.resume();
    const layers = buildRecipe(name, options);
    if (this.voices + layers.length > MAX_VOICES) return;
    const start = ctx.currentTime + 0.005;
    for (const layer of layers) this.schedule(layer, start, options.pitch ?? 1);
  }

  private noise(): AudioBuffer {
    if (!this.noiseBuffer) {
      const ctx = this.ctx!;
      const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 2)), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  private applyFilter(spec: FilterSpec, start: number, end: number, pitch: number): BiquadFilterNode {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = spec.type;
    f.Q.value = spec.q ?? 0.7;
    f.frequency.setValueAtTime(first(spec.freq) * pitch, start);
    if (typeof spec.freq !== 'number') f.frequency.exponentialRampToValueAtTime(Math.max(20, last(spec.freq) * pitch), end);
    return f;
  }

  private schedule(layer: Layer, base: number, pitch: number): void {
    const ctx = this.ctx!;
    const start = base + (layer.delay ?? 0);
    const attack = layer.attack ?? 0.005;
    const peakAt = start + attack;
    const end = peakAt + layer.decay;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(FLOOR, start);
    gain.gain.linearRampToValueAtTime(Math.max(FLOOR, layer.gain), peakAt);
    gain.gain.exponentialRampToValueAtTime(FLOOR, end);

    let source: AudioScheduledSourceNode;
    if (layer.kind === 'osc') {
      const o = ctx.createOscillator();
      o.type = layer.wave;
      o.frequency.setValueAtTime(Math.max(10, first(layer.freq) * pitch), start);
      if (typeof layer.freq !== 'number') o.frequency.exponentialRampToValueAtTime(Math.max(10, last(layer.freq) * pitch), end);
      source = o;
    } else {
      const n = ctx.createBufferSource();
      n.buffer = this.noise();
      n.loop = true;
      source = n;
    }

    let node: AudioNode = source;
    if (layer.filter) {
      const f = this.applyFilter(layer.filter, start, end, pitch);
      node.connect(f);
      node = f;
    }
    node.connect(gain);
    gain.connect(this.master!);

    this.voices++;
    source.onended = () => {
      this.voices = Math.max(0, this.voices - 1);
      source.disconnect();
      gain.disconnect();
    };
    if (layer.kind === 'noise') (source as AudioBufferSourceNode).start(start, Math.random() * 1.5);
    else source.start(start);
    source.stop(end + 0.05);
  }

  /** Toplam süre (sn); arayüz sesin bitmesini beklemek isterse. */
  durationOf(name: SoundName, options: SoundOptions = {}): number {
    return recipeDuration(buildRecipe(name, options));
  }

  /**
   * Çizim sırasında sürekli ses: kalem hızlandıkça yükselir ve parlar, durunca kısılır.
   * Sessizdeyse ya da bağlam yoksa hiçbir şey yapmaz.
   */
  beginDraw(element: Element): DrawLoop {
    if (!this.ready) return NO_DRAW;
    const ctx = this.ctx!;
    const tone = DRAW_TONES[element];

    const src = ctx.createBufferSource();
    src.buffer = this.noise();
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = tone.type;
    filter.Q.value = tone.q;
    filter.frequency.value = tone.freq;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    src.start();
    this.voices++;

    let ended = false;
    return {
      update: (speed: number) => {
        if (ended) return;
        const s = Math.min(1, Math.max(0, speed));
        const t = ctx.currentTime;
        gain.gain.setTargetAtTime(0.02 + s * 0.16, t, 0.05);
        filter.frequency.setTargetAtTime(tone.freq * (0.7 + s * 0.9), t, 0.05);
      },
      end: () => {
        if (ended) return;
        ended = true;
        const t = ctx.currentTime;
        gain.gain.setTargetAtTime(0, t, 0.04);
        src.stop(t + 0.3);
        src.onended = () => {
          this.voices = Math.max(0, this.voices - 1);
          src.disconnect();
          filter.disconnect();
          gain.disconnect();
        };
      },
    };
  }
}

let shared: SoundEngine | null = null;

/** Tüm ekranların paylaştığı tek ses motoru. */
export function getSoundEngine(): SoundEngine {
  return (shared ??= new SoundEngine());
}
