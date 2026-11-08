import type { Element } from '../../battle/damage/elements';

/**
 * Ses efektleri koddan üretilir (dosya yok, telifsiz). Her ses, birkaç "katmandan" oluşan bir tariftir:
 * bir osilatör ya da gürültü, isteğe bağlı filtre ve bir zarf (hızlı yükseliş, yavaş sönüş).
 * Tarifler saf veridir; çalmayı `SoundEngine` yapar.
 */

export type Sweep = number | readonly [number, number];

export interface FilterSpec {
  type: BiquadFilterType;
  /** Tek değer ya da başlangıç→bitiş (üstel kayma) */
  freq: Sweep;
  q?: number;
}

interface LayerBase {
  /** Tepe ses seviyesi (0-1) */
  gain: number;
  /** Yükseliş süresi (sn); varsayılan 0.005 */
  attack?: number;
  /** Sönüş süresi (sn) */
  decay: number;
  /** Başlamadan önce bekleme (sn) */
  delay?: number;
  filter?: FilterSpec;
}

export interface OscLayer extends LayerBase {
  kind: 'osc';
  wave: OscillatorType;
  freq: Sweep;
}

export interface NoiseLayer extends LayerBase {
  kind: 'noise';
}

export type Layer = OscLayer | NoiseLayer;

export type SoundName =
  | 'charge' // büyü havada çizilirken
  | 'launch' // büyü fırlarken
  | 'impact' // vuruş
  | 'crit' // başa vuruş, ek tını
  | 'shieldUp'
  | 'shieldBlock'
  | 'shieldBreak'
  | 'fizzle' // büyü yapılamadı
  | 'defeat'
  | 'pick' // arayüz tıklaması
  | 'turn'
  | 'revealAdvantage'
  | 'revealDisadvantage'
  | 'revealNeutral'
  | 'victory'
  | 'lose';

export const SOUND_NAMES: readonly SoundName[] = [
  'charge', 'launch', 'impact', 'crit', 'shieldUp', 'shieldBlock', 'shieldBreak', 'fizzle',
  'defeat', 'pick', 'turn', 'revealAdvantage', 'revealDisadvantage', 'revealNeutral', 'victory', 'lose',
];

export interface SoundOptions {
  /** Büyünün elementi (charge, launch, impact için) */
  element?: Element;
  /** 0-1: vuruş şiddeti ya da savunulan oran */
  intensity?: number;
  /** Frekans çarpanı (1 = değişmez) */
  pitch?: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

const osc = (wave: OscillatorType, freq: Sweep, gain: number, decay: number, extra: Partial<OscLayer> = {}): OscLayer => ({ kind: 'osc', wave, freq, gain, decay, ...extra });
const noise = (gain: number, decay: number, extra: Partial<NoiseLayer> = {}): NoiseLayer => ({ kind: 'noise', gain, decay, ...extra });
const lp = (freq: Sweep, q = 0.7): FilterSpec => ({ type: 'lowpass', freq, q });
const hp = (freq: Sweep, q = 0.7): FilterSpec => ({ type: 'highpass', freq, q });
const bp = (freq: Sweep, q = 1.2): FilterSpec => ({ type: 'bandpass', freq, q });

/** Büyü yükleniyor: elemente göre karakterli, yükselen bir ses. */
function charge(el: Element): Layer[] {
  switch (el) {
    case 'fire':
      return [
        noise(0.22, 0.95, { attack: 0.05, filter: bp([1200, 3400], 0.9) }),
        osc('sawtooth', [110, 330], 0.1, 0.95, { attack: 0.3, filter: lp(1200) }),
        osc('square', 55, 0.07, 0.9, { attack: 0.2, filter: lp(300) }),
      ];
    case 'water':
      return [
        osc('sine', [400, 900], 0.15, 0.28),
        osc('sine', [450, 1000], 0.14, 0.28, { delay: 0.2 }),
        osc('sine', [520, 1150], 0.14, 0.28, { delay: 0.42 }),
        osc('sine', [600, 1300], 0.12, 0.3, { delay: 0.65 }),
        noise(0.12, 0.95, { attack: 0.3, filter: lp(700) }),
      ];
    case 'earth':
      return [
        osc('sine', [50, 85], 0.35, 0.95, { attack: 0.35 }),
        osc('triangle', 90, 0.12, 0.9, { attack: 0.4, filter: lp(250) }),
        noise(0.3, 0.9, { attack: 0.35, filter: lp(260) }),
      ];
    case 'air':
      return [
        noise(0.22, 0.95, { attack: 0.8, filter: bp([2000, 5200], 1.4) }),
        osc('sine', [800, 1700], 0.08, 0.95, { attack: 0.5 }),
      ];
  }
}

function launch(el: Element): Layer[] {
  switch (el) {
    case 'fire':
      return [noise(0.35, 0.6, { attack: 0.03, filter: hp([600, 2400]) }), osc('sawtooth', [220, 90], 0.14, 0.5, { filter: lp(900) })];
    case 'water':
      return [noise(0.3, 0.6, { attack: 0.05, filter: bp([500, 1500], 1.1) }), osc('sine', [300, 700], 0.14, 0.5)];
    case 'earth':
      return [noise(0.4, 0.6, { attack: 0.03, filter: lp(420) }), osc('sine', [70, 45], 0.4, 0.55)];
    case 'air':
      return [noise(0.42, 0.55, { attack: 0.08, filter: bp([400, 3200], 0.9) })];
  }
}

function impact(el: Element, intensity: number, pitch: number): Layer[] {
  const k = 0.4 + 0.6 * intensity; // şiddet: ses seviyesi ve ağırlık
  const low = (f: number): number => f * (1.15 - 0.3 * intensity) * pitch; // güçlü vuruş daha derin
  switch (el) {
    case 'fire':
      return [
        noise(0.6 * k, 0.75, { filter: lp([3000, 200]) }),
        osc('sine', [low(120), low(40)], 0.7 * k, 0.6),
        noise(0.28 * k, 0.12, { delay: 0.05, filter: hp(3200) }),
        noise(0.22 * k, 0.12, { delay: 0.12, filter: hp(3600) }),
      ];
    case 'water':
      return [
        noise(0.55 * k, 0.65, { filter: bp([1800, 400], 0.8) }),
        osc('sine', [low(200), low(80)], 0.5 * k, 0.5),
        osc('sine', [900, 1500], 0.12 * k, 0.12, { delay: 0.1 }),
        osc('sine', [700, 1200], 0.1 * k, 0.12, { delay: 0.2 }),
      ];
    case 'earth':
      return [
        osc('sine', [low(90), low(30)], 0.9 * k, 0.9),
        noise(0.7 * k, 0.5, { filter: lp([500, 100]) }),
        noise(0.3 * k, 0.07, { delay: 0.08, filter: bp(1200, 2) }),
        noise(0.25 * k, 0.07, { delay: 0.15, filter: bp(1500, 2) }),
      ];
    case 'air':
      return [
        noise(0.6 * k, 0.25, { filter: hp(2500) }),
        osc('sine', [low(300), low(100)], 0.4 * k, 0.4),
        noise(0.3 * k, 0.5, { filter: bp([3000, 500], 0.9) }),
      ];
  }
}

type Trim = number | Record<Element, number>;

/**
 * Seviye düzeltmeleri. Bütün sesler çevrimdışı üretilip ölçüldü (tepe seviyesi); sesler birbirine yakın
 * duyulsun diye her biri hedef seviyeye çekilir: vuruşlar en yüksek, arayüz sesleri en alçak.
 * Ses ayarlanınca `?lab=sound` ve ölçüm betiğiyle yeniden bakılır.
 */
const TRIM: Partial<Record<SoundName, Trim>> = {
  charge: { fire: 1.7, water: 1.6, earth: 0.85, air: 1.7 },
  launch: { fire: 1.2, water: 2.6, earth: 1.7, air: 2.5 },
  impact: { fire: 1.35, water: 2.1, earth: 1.5, air: 1.8 },
  crit: 1.4,
  shieldUp: 1.25,
  shieldBlock: 1.8,
  shieldBreak: 1.5,
  fizzle: 2.4,
  defeat: 0.9,
  pick: 3.2,
  turn: 2.1,
  revealAdvantage: 1.1,
  revealNeutral: 3.5,
  victory: 1.35,
  lose: 1.3,
};

/** Sesin dünyasına özgü tarifini döndürür (seviye düzeltmesi uygulanmış). */
export function buildRecipe(name: SoundName, options: SoundOptions = {}): Layer[] {
  const trim = TRIM[name];
  const factor = trim === undefined ? 1 : typeof trim === 'number' ? trim : trim[options.element ?? 'fire'];
  return rawRecipe(name, options).map((l) => ({ ...l, gain: Math.min(1, l.gain * factor) }));
}

function rawRecipe(name: SoundName, options: SoundOptions = {}): Layer[] {
  const el = options.element ?? 'fire';
  const intensity = clamp01(options.intensity ?? 0.5);
  const pitch = options.pitch && options.pitch > 0 ? options.pitch : 1;

  switch (name) {
    case 'charge':
      return charge(el);
    case 'launch':
      return launch(el);
    case 'impact':
      return impact(el, intensity, pitch);
    case 'crit':
      return [osc('sine', 1568, 0.22, 0.4), osc('sine', 2093, 0.18, 0.4, { delay: 0.06 }), osc('triangle', 784, 0.1, 0.35)];
    case 'shieldUp':
      return [
        osc('sine', 523, 0.12, 0.5),
        osc('sine', 784, 0.11, 0.5, { delay: 0.06 }),
        osc('sine', 1047, 0.1, 0.5, { delay: 0.12 }),
        osc('sine', 110, 0.1, 0.6, { attack: 0.1 }),
      ];
    case 'shieldBlock': {
      const k = 0.35 + 0.65 * intensity;
      return [
        osc('triangle', [1200, 1170], 0.32 * k, 0.55),
        osc('sine', [1800, 1750], 0.18 * k, 0.45),
        osc('sine', [2630, 2600], 0.1 * k, 0.35),
        noise(0.3 * k, 0.1, { filter: hp(4000) }),
      ];
    }
    case 'shieldBreak':
      return [
        noise(0.5, 0.5, { filter: hp(3000) }),
        osc('sine', [1800, 300], 0.16, 0.45),
        osc('sine', [2200, 400], 0.12, 0.45, { delay: 0.05 }),
        osc('sine', [1500, 250], 0.12, 0.5, { delay: 0.1 }),
      ];
    case 'fizzle':
      return [noise(0.26, 0.65, { filter: bp([1500, 300], 0.9) }), osc('sine', [400, 120], 0.12, 0.55)];
    case 'defeat':
      return [
        osc('sine', [300, 60], 0.5, 1.0),
        noise(0.3, 1.0, { filter: lp(400) }),
        osc('sine', [110, 40], 0.5, 0.9, { delay: 0.2 }),
      ];
    case 'pick':
      return [osc('sine', [660, 880], 0.2, 0.12)];
    case 'turn':
      return [osc('sine', 520, 0.14, 0.15), osc('sine', 780, 0.1, 0.18, { delay: 0.07 })];
    case 'revealAdvantage':
      return [523, 659, 784].map((f, i) => osc('sine', f * pitch, 0.2, 0.32, { delay: i * 0.08 }));
    case 'revealDisadvantage':
      return [392, 330, 262].map((f, i) => osc('triangle', f * pitch, 0.22, 0.34, { delay: i * 0.09 }));
    case 'revealNeutral':
      return [osc('sine', 440 * pitch, 0.18, 0.25)];
    case 'victory':
      return [
        ...[523, 659, 784, 1047].map((f, i) => osc('triangle', f, 0.22, 0.6, { delay: i * 0.12 })),
        osc('sine', 1047, 0.12, 0.9, { delay: 0.48 }),
        osc('sine', 1319, 0.1, 0.9, { delay: 0.48 }),
        osc('sine', 1568, 0.08, 0.9, { delay: 0.48 }),
      ];
    case 'lose':
      return [440, 392, 349, 294].map((f, i) => osc('triangle', f, 0.22, 0.55, { delay: i * 0.16 }));
  }
}

/** Tarifin toplam süresi (sn): en geç biten katmanın sonu. */
export function recipeDuration(layers: readonly Layer[]): number {
  return layers.reduce((max, l) => Math.max(max, (l.delay ?? 0) + (l.attack ?? 0.005) + l.decay), 0);
}
