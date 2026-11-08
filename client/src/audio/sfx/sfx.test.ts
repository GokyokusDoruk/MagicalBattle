import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../../battle/damage/elements';
import { MAX_VOICES, SoundEngine } from './engine';
import { SOUND_NAMES, buildRecipe, recipeDuration, type Layer } from './recipes';

// --- Sahte ses bağlamı: ne çalındığını kaydeder, gerçek ses üretmez -----------------------------

class FakeParam {
  value = 0;
  calls: { fn: string; args: number[] }[] = [];
  setValueAtTime(v: number, t: number) { this.calls.push({ fn: 'set', args: [v, t] }); }
  linearRampToValueAtTime(v: number, t: number) { this.calls.push({ fn: 'linear', args: [v, t] }); }
  exponentialRampToValueAtTime(v: number, t: number) { this.calls.push({ fn: 'exp', args: [v, t] }); }
  setTargetAtTime(v: number, t: number, tc: number) { this.calls.push({ fn: 'target', args: [v, t, tc] }); }
}

class FakeNode {
  kind: string;
  connections: FakeNode[] = [];
  onended: (() => void) | null = null;
  started: number[] | null = null;
  stopped: number | null = null;
  type = '';
  loop = false;
  buffer: unknown = null;
  frequency = new FakeParam();
  gain = new FakeParam();
  Q = new FakeParam();
  constructor(kind: string) { this.kind = kind; }
  connect(n: FakeNode) { this.connections.push(n); return n; }
  disconnect() { this.connections = []; }
  start(...a: number[]) { this.started = a; }
  stop(t: number) { this.stopped = t; }
}

class FakeCtx {
  currentTime = 1;
  sampleRate = 8000;
  state: 'running' | 'suspended' = 'running';
  resumed = 0;
  buffersCreated = 0;
  destination = new FakeNode('destination');
  nodes: FakeNode[] = [];
  private make(kind: string): FakeNode {
    const n = new FakeNode(kind);
    this.nodes.push(n);
    return n;
  }
  createGain() { return this.make('gain'); }
  createOscillator() { return this.make('osc'); }
  createBufferSource() { return this.make('noise'); }
  createBiquadFilter() { return this.make('filter'); }
  createDynamicsCompressor() { return this.make('compressor'); }
  createBuffer(_ch: number, len: number) {
    this.buffersCreated++;
    return { length: len, getChannelData: () => new Float32Array(len) };
  }
  resume() { this.resumed++; this.state = 'running'; return Promise.resolve(); }
  count(kind: string) { return this.nodes.filter((n) => n.kind === kind).length; }
}

const make = () => {
  const ctx = new FakeCtx();
  let created = 0;
  const engine = new SoundEngine(() => {
    created++;
    return ctx as unknown as AudioContext;
  });
  return { ctx, engine, created: () => created };
};

// --- Tarifler ----------------------------------------------------------------------------

const freqs = (l: Layer): number[] => (l.kind === 'osc' ? (typeof l.freq === 'number' ? [l.freq] : [...l.freq]) : []);

describe('ses tarifleri', () => {
  it('her ses geçerli tarife sahip: sonlu sayılar, pozitif frekans ve süre, 0-1 arası seviye', () => {
    for (const name of SOUND_NAMES) {
      for (const element of ELEMENTS) {
        const layers = buildRecipe(name, { element, intensity: 0.7 });
        expect(layers.length, `${name}/${element}`).toBeGreaterThan(0);
        for (const l of layers) {
          expect(l.gain).toBeGreaterThan(0);
          expect(l.gain).toBeLessThanOrEqual(1);
          expect(l.decay).toBeGreaterThan(0);
          expect(l.delay ?? 0).toBeGreaterThanOrEqual(0);
          for (const f of freqs(l)) expect(f).toBeGreaterThan(0);
          if (l.filter) for (const f of typeof l.filter.freq === 'number' ? [l.filter.freq] : l.filter.freq) expect(f).toBeGreaterThan(0);
          expect(Number.isFinite(l.gain + l.decay)).toBe(true);
        }
      }
    }
  });

  it('hiçbir ses 2 saniyeden uzun sürmez (kuyruk yok, telefon yorulmaz)', () => {
    for (const name of SOUND_NAMES) {
      for (const element of ELEMENTS) expect(recipeDuration(buildRecipe(name, { element, intensity: 1 })), name).toBeLessThanOrEqual(2);
    }
  });

  it('elementler birbirinden farklı ses verir (şarj, fırlatma, vuruş)', () => {
    for (const name of ['charge', 'launch', 'impact'] as const) {
      const sigs = new Set(ELEMENTS.map((element) => JSON.stringify(buildRecipe(name, { element, intensity: 0.5 }))));
      expect(sigs.size, name).toBe(ELEMENTS.length);
    }
  });

  it('vuruş şiddeti arttıkça sesin seviyesi artar ve ses daha derinleşir', () => {
    for (const element of ELEMENTS) {
      const soft = buildRecipe('impact', { element, intensity: 0.1 });
      const hard = buildRecipe('impact', { element, intensity: 1 });
      expect(hard[0].gain, element).toBeGreaterThan(soft[0].gain);
      const lowOsc = (ls: Layer[]) => Math.min(...ls.filter((l) => l.kind === 'osc').flatMap(freqs));
      expect(lowOsc(hard), element).toBeLessThan(lowOsc(soft));
    }
  });

  it('pitch çarpanı frekansları orantılı değiştirir', () => {
    const a = buildRecipe('revealAdvantage', {});
    const b = buildRecipe('revealAdvantage', { pitch: 2 });
    expect(freqs(b[0])[0]).toBeCloseTo(freqs(a[0])[0] * 2);
  });

  it('bilinen yöne bakan sesler: üstünlük yükselir, dezavantaj alçalır', () => {
    const up = buildRecipe('revealAdvantage').map((l) => freqs(l)[0]);
    const down = buildRecipe('revealDisadvantage').map((l) => freqs(l)[0]);
    expect(up).toEqual([...up].sort((x, y) => x - y));
    expect(down).toEqual([...down].sort((x, y) => y - x));
    const lose = buildRecipe('lose').map((l) => freqs(l)[0]);
    expect(lose).toEqual([...lose].sort((x, y) => y - x));
  });

  it('recipeDuration gecikmeyi, yükselişi ve sönüşü hesaba katar', () => {
    expect(recipeDuration([{ kind: 'noise', gain: 0.1, decay: 0.5, delay: 0.3, attack: 0.1 }])).toBeCloseTo(0.9);
    expect(recipeDuration([])).toBe(0);
  });

  it('seçenekler verilmezse varsayılanlarla çalışır', () => {
    expect(() => buildRecipe('impact')).not.toThrow();
    expect(buildRecipe('impact', { intensity: 99 })).toEqual(buildRecipe('impact', { intensity: 1 }));
    expect(buildRecipe('impact', { pitch: -3 })).toEqual(buildRecipe('impact', { pitch: 1 }));
  });
});

// --- Motor -------------------------------------------------------------------------------

describe('SoundEngine', () => {
  it('unlock öncesi çalma sessizce yok sayılır, bağlam oluşturulmaz', () => {
    const { engine, created } = make();
    engine.play('impact', { element: 'fire' });
    expect(created()).toBe(0);
    expect(engine.activeVoices).toBe(0);
  });

  it('unlock bağlamı bir kez kurar: ana ses → sıkıştırıcı → çıkış, askıdaysa devam ettirir', () => {
    const { ctx, engine, created } = make();
    ctx.state = 'suspended';
    engine.unlock();
    engine.unlock();
    expect(created()).toBe(1);
    expect(ctx.resumed).toBeGreaterThanOrEqual(1);
    const master = ctx.nodes.find((n) => n.kind === 'gain')!;
    const comp = ctx.nodes.find((n) => n.kind === 'compressor')!;
    expect(master.connections).toContain(comp);
    expect(comp.connections).toContain(ctx.destination);
  });

  it('her katman için bir kaynak kurar, filtre ve zarf üzerinden ana sese bağlar, zamanlar', () => {
    const { ctx, engine } = make();
    engine.unlock();
    const master = ctx.nodes.find((n) => n.kind === 'gain')!;
    const before = ctx.nodes.length;
    engine.play('impact', { element: 'earth', intensity: 0.8 });
    const layers = buildRecipe('impact', { element: 'earth', intensity: 0.8 });
    const sources = ctx.nodes.slice(before).filter((n) => n.kind === 'osc' || n.kind === 'noise');
    expect(sources).toHaveLength(layers.length);
    for (const s of sources) {
      expect(s.started).not.toBeNull();
      expect(s.stopped).toBeGreaterThan(s.started![0]);
    }
    // her zarf (gain) düğümü ana sese bağlı
    const envelopes = ctx.nodes.slice(before).filter((n) => n.kind === 'gain');
    expect(envelopes).toHaveLength(layers.length);
    for (const e of envelopes) expect(e.connections).toContain(master);
    // zarf: tepeye çıkıp üstel sönüyor
    expect(envelopes[0].gain.calls.map((c) => c.fn)).toEqual(['set', 'linear', 'exp']);
    expect(engine.activeVoices).toBe(layers.length);
  });

  it('kaynaklar bitince ses sayacı azalır ve düğümler bırakılır', () => {
    const { ctx, engine } = make();
    engine.unlock();
    engine.play('pick');
    const n = engine.activeVoices;
    expect(n).toBeGreaterThan(0);
    for (const node of ctx.nodes.filter((x) => x.onended)) node.onended!();
    expect(engine.activeVoices).toBe(0);
  });

  it('frekans kayması olan katmanlarda üstel rampa kurulur', () => {
    const { ctx, engine } = make();
    engine.unlock();
    engine.play('fizzle'); // osc [400,120] + filtre kayması
    const osc = ctx.nodes.find((n) => n.kind === 'osc')!;
    expect(osc.frequency.calls.some((c) => c.fn === 'exp')).toBe(true);
    const filter = ctx.nodes.find((n) => n.kind === 'filter')!;
    expect(filter.frequency.calls.some((c) => c.fn === 'exp')).toBe(true);
  });

  it('gürültü tamponu bağlam başına bir kez üretilir', () => {
    const { ctx, engine } = make();
    engine.unlock();
    engine.play('launch', { element: 'air' });
    engine.play('launch', { element: 'fire' });
    expect(ctx.buffersCreated).toBe(1);
  });

  it('sessizdeyken hiçbir düğüm kurulmaz, ana ses 0\'a çekilir; açılınca geri gelir', () => {
    const { ctx, engine } = make();
    engine.unlock();
    const master = ctx.nodes.find((n) => n.kind === 'gain')!;
    engine.setMuted(true);
    const before = ctx.nodes.length;
    engine.play('victory');
    expect(ctx.nodes.length).toBe(before);
    expect(master.gain.calls[master.gain.calls.length - 1].args[0]).toBe(0);
    engine.setMuted(false);
    expect(master.gain.calls[master.gain.calls.length - 1].args[0]).toBeCloseTo(engine.currentVolume);
    engine.play('pick');
    expect(ctx.nodes.length).toBeGreaterThan(before);
  });

  it('sessize alma unlock\'tan önce yapılsa da korunur', () => {
    const { ctx, engine } = make();
    engine.setMuted(true);
    engine.unlock();
    const master = ctx.nodes.find((n) => n.kind === 'gain')!;
    expect(master.gain.value).toBe(0);
    expect(engine.isMuted).toBe(true);
  });

  it('ses seviyesi 0-1 arasına kırpılır, geçersiz değer yok sayılır', () => {
    const { engine } = make();
    engine.setVolume(5);
    expect(engine.currentVolume).toBe(1);
    engine.setVolume(-2);
    expect(engine.currentVolume).toBe(0);
    engine.setVolume(0.3);
    engine.setVolume(Number.NaN);
    expect(engine.currentVolume).toBe(0.3);
  });

  it('aynı anda çalan ses sayısı sınırlıdır (üst üste yığılma olmaz)', () => {
    const { engine } = make();
    engine.unlock();
    for (let i = 0; i < 60; i++) engine.play('impact', { element: 'fire', intensity: 1 });
    expect(engine.activeVoices).toBeLessThanOrEqual(MAX_VOICES);
    expect(engine.activeVoices).toBeGreaterThan(0);
  });

  it('ses bağlamı desteklenmeyen cihazda hiçbir şey patlamaz', () => {
    const engine = new SoundEngine(() => null);
    expect(() => {
      engine.unlock();
      engine.play('impact');
      engine.setMuted(true);
      engine.setVolume(0.5);
      engine.beginDraw('fire').update(0.5);
    }).not.toThrow();
    expect(engine.activeVoices).toBe(0);
  });

  it('durationOf tarifin süresini verir', () => {
    const { engine } = make();
    expect(engine.durationOf('victory')).toBeGreaterThan(engine.durationOf('pick'));
  });
});

describe('çizim sesi (beginDraw)', () => {
  it('kalem hızına göre ses ve filtre güncellenir, end sesi kısıp durdurur', () => {
    const { ctx, engine } = make();
    engine.unlock();
    const loop = engine.beginDraw('water');
    const sources = ctx.nodes.filter((n) => n.kind === 'noise');
    expect(sources).toHaveLength(1);
    expect(sources[0].loop).toBe(true);
    expect(engine.activeVoices).toBe(1);

    const gain = ctx.nodes[ctx.nodes.length - 1];
    loop.update(0);
    const slow = gain.gain.calls[gain.gain.calls.length - 1].args[0];
    loop.update(1);
    const fast = gain.gain.calls[gain.gain.calls.length - 1].args[0];
    expect(fast).toBeGreaterThan(slow);

    loop.end();
    expect(sources[0].stopped).not.toBeNull();
    sources[0].onended!();
    expect(engine.activeVoices).toBe(0);
  });

  it('end ikinci kez çağrılsa ya da bittikten sonra update gelse zarar vermez', () => {
    const { ctx, engine } = make();
    engine.unlock();
    const loop = engine.beginDraw('fire');
    loop.end();
    const calls = ctx.nodes.reduce((s, n) => s + n.gain.calls.length, 0);
    loop.end();
    loop.update(1);
    expect(ctx.nodes.reduce((s, n) => s + n.gain.calls.length, 0)).toBe(calls);
  });

  it('sessizdeyken ya da kilit açılmadan boş döngü döner', () => {
    const { ctx, engine } = make();
    engine.beginDraw('air').update(1); // kilit yok
    engine.unlock();
    engine.setMuted(true);
    const before = ctx.nodes.length;
    engine.beginDraw('air').end();
    expect(ctx.nodes.length).toBe(before);
  });

  it('her element farklı çizim tonu kullanır', () => {
    const tones = new Set<number>();
    for (const e of ELEMENTS) {
      const { ctx, engine } = make();
      engine.unlock();
      engine.beginDraw(e);
      tones.add(ctx.nodes.find((n) => n.kind === 'filter')!.frequency.value);
    }
    expect(tones.size).toBe(ELEMENTS.length);
  });
});
