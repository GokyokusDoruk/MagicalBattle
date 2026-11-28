import { BRUSH_RADIUS, CELL, DWELL_SAMPLE_MS, GRID, LOGICAL_SIZE } from '../battle/gesture/config';
import { normPose, silhouetteShape, type TargetPose } from '../battle/damage/target';
import type { Element } from '../battle/damage/elements';
import { ElementParticles, drawBurnScar, drawElementStrokes, drawMudPatch, preloadTextures } from './elementFx';
import { areaPlan, type AreaRegion } from '../battle/gesture/area';
import { buildDensity } from '../battle/gesture/density';
import { DrawingSession, type SessionOptions } from '../battle/gesture/session';
import type { DrawingResult, Stroke } from '../battle/gesture/types';
import type { DrawLoop } from '../audio/sfx/engine';

export interface DrawingCanvasOptions extends SessionOptions {
  /** Fırça rengi (elementin rengi) */
  color: string;
  /** Soluk "hayalet" olarak gösterilecek çizgiler (savunan, gelen saldırıyı görür) */
  ghost?: readonly Stroke[];
  /**
   * Faz 3: tuvalde gösterilecek büyücü silüeti (saldırıda rakip, savunmada kendin). Silüete düşen büyü tam vurur, başa düşen daha çok;
   * dışına giden çok az. Silüette yazı yoktur (başın nerede olduğu yazılmaz, yalnızca görülür).
   */
  target?: TargetPose;
  /** Silüetin tonu: rakip (kırmızımsı) ya da kendi silüetin (mavimsi). Varsayılan rakip. */
  targetTone?: 'enemy' | 'self';
  /** Her çizgi başlarken çağrılır; kalem hızına göre sürekli ses verir (ör. `engine.beginDraw`) */
  drawSound?: () => DrawLoop;
  /** Yanık İzi: ekranda beliren yara izi sayısı (görüşü örter, çizimi engellemez). */
  scars?: number;
  /** Sis Perdesi: savunma ekranını kaplayan sis bulutu sayısı (altındaki çizim ve hayalet görünmez) */
  fog?: number;
  /** Sarsıntılı Rüzgâr: çizim ekranının sarsıntı şiddeti (1-3); tuval titrer, çizmek zorlaşır */
  shake?: number;
  /** Çamur Yaması: savunma ekranındaki çamur yaması sayısı (görüşü örter, çizimi engellemez) */
  mud?: number;
  /**
   * Faz 5: birinci kişi bakış. Tuval yarı saydam olur, arkasında arena (rakip) görünür; ekrana çizilir gibi.
   */
  overlay?: boolean;
  /** Faz 5: kalemin yeri (-1..1, sağ/üst artı) ve çizim sürüyor mu; ekrandaki el ve asa buna uzanır */
  onAim?: (nx: number, ny: number, down: boolean) => void;
  /**
   * Faz 6: alan gücü (hücre). Verilirse çizerken kapalı bölgeler canlı gösterilir: gücün yettiği bölgeler yeşil (dolacak),
   * yetmeyenler kırmızı (boş kalacak; başka bir çizgiyle bölüp küçültebilirsin).
   */
  areaCapacity?: number;
  /** Faz 4: kalemin elementi (ateş alevle, su suyla, toprak toprakla, hava rüzgârla çizer); verilmezse düz renkli kalem */
  element?: Element;
  /** Rastgelelik kaynağı (iz konumları); testler sabit verir */
  random?: () => number;
}

/**
 * Büyücü silüeti (Faz 3): eklemli bir kukla (gövde, kollar, bacaklar, baş; eller ve ayaklar başla aynı büyüklükte yuvarlak).
 * - **Rakip** (`enemy`, yalnızca Kolay'da saldırırken): bulanık, tek renk kırmızımsı gölge. Baş, eller ve ayaklar aynı görünür;
 *   başın hangisi olduğu anlaşılmaz.
 * - **Kendin** (`self`, yer seçerken ve savunurken): mavimsi gölge; **başın** parlak bir halkayla belli olur (neresini koruyacağını bilirsin).
 * `scale`: mantıksal birimden piksele çarpan.
 */
export function paintSilhouette(ctx: CanvasRenderingContext2D, target: TargetPose, scale: number, tone: 'enemy' | 'self' = 'enemy'): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const key = `${target.cx}:${target.cy}:${target.scale}:${normPose(target.pose)}:${scale}:${w}:${h}:${tone}`;
  if (silhouetteCache?.key !== key) silhouetteCache = { key, image: renderSilhouetteLayer(target, scale, w, h, tone) };
  if (!silhouetteCache.image) return;
  ctx.save();
  ctx.globalAlpha = tone === 'self' ? 0.3 : 0.28;
  ctx.shadowColor = tone === 'self' ? 'rgba(96,165,250,0.9)' : 'rgba(239,68,68,0.9)';
  ctx.shadowBlur = (tone === 'self' ? 8 : 18) * scale;
  ctx.drawImage(silhouetteCache.image, 0, 0);
  ctx.restore();
  if (tone === 'self') {
    // Kendi başın: yalnızca sana görünen parlak halka
    const head = silhouetteShape(target).head;
    ctx.save();
    ctx.strokeStyle = 'rgba(186,230,253,0.85)';
    ctx.lineWidth = Math.max(1.5, 2.5 * scale);
    ctx.beginPath();
    ctx.arc(head.x * scale, head.y * scale, head.r * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** Her karede yeniden çizmemek için son silüet katmanı saklanır */
let silhouetteCache: { key: string; image: HTMLCanvasElement | null } | null = null;

function renderSilhouetteLayer(target: TargetPose, scale: number, w: number, h: number, tone: 'enemy' | 'self'): HTMLCanvasElement | null {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const o = off.getContext('2d');
  if (!o) return null;
  const color = tone === 'self' ? 'rgb(96,165,250)' : 'rgb(239,68,68)';
  // Rakibin gölgesi ayrıca bulanıklaşır: kenarlar belirsiz, parçalar birbirine karışır
  if (tone === 'enemy' && 'filter' in o) o.filter = `blur(${Math.max(1, Math.round(3 * scale))}px)`;
  const shape = silhouetteShape(target);
  o.strokeStyle = color;
  o.fillStyle = color;
  o.lineCap = 'round';
  for (const g of shape.segments) {
    o.lineWidth = g.r * 2 * scale;
    o.beginPath();
    o.moveTo(g.ax * scale, g.ay * scale);
    o.lineTo(g.bx * scale, g.by * scale);
    o.stroke();
  }
  for (const c of [shape.head, ...shape.ends]) {
    o.beginPath();
    o.arc(c.x * scale, c.y * scale, c.r * scale, 0, Math.PI * 2);
    o.fill();
  }
  return off;
}

/** Çizim ekranındaki bir yara izi (mantıksal koordinat) */
interface Scar {
  x: number;
  y: number;
  angle: number;
}

/** Yara izinin boyu (mantıksal birim); yalnızca görüntüdür, çizimi engellemez */
export const SCAR_RADIUS = 16;

/**
 * Yara izi konumları: kenarlardan uzak, birbirinden ayrı ve ortadaki çizim alanına rastgele serpilir.
 * (Saf fonksiyon: testlenebilir.)
 */
export function placeScars(count: number, random: () => number = Math.random): { x: number; y: number; angle: number }[] {
  const out: { x: number; y: number; angle: number }[] = [];
  const margin = 36;
  for (let i = 0; i < count; i++) {
    let best = { x: 0, y: 0, angle: 0 };
    for (let attempt = 0; attempt < 30; attempt++) {
      const c = { x: margin + random() * (LOGICAL_SIZE - 2 * margin), y: margin + random() * (LOGICAL_SIZE - 2 * margin), angle: (random() - 0.5) * Math.PI };
      best = c;
      if (out.every((o) => Math.hypot(o.x - c.x, o.y - c.y) > SCAR_RADIUS * 3)) break;
    }
    out.push(best);
  }
  return out;
}

/** Sis bulutu konumları: tuvale yayılır (saf fonksiyon). */
export function placeFog(count: number, random: () => number = Math.random): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < count; i++) out.push({ x: 40 + random() * (LOGICAL_SIZE - 80), y: 70 + random() * (LOGICAL_SIZE - 120), r: 48 + random() * 22 });
  return out;
}

/** Çamur yaması konumları (saf fonksiyon). */
export function placeMud(count: number, random: () => number = Math.random): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < count; i++) out.push({ x: 50 + random() * (LOGICAL_SIZE - 100), y: 80 + random() * (LOGICAL_SIZE - 130), r: 26 + random() * 12 });
  return out;
}

/**
 * Büyü çizim tuvali: parmak ya da fare ile çizilir, süre ilk dokunuşta başlar.
 * Geri sayım çubuğu ve "Bitir" düğmesi içerir. `start()` tur bitince sonucu döndürür.
 */
export class DrawingCanvas {
  readonly element: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fill: HTMLDivElement;
  private readonly label: HTMLSpanElement;
  private readonly finishBtn: HTMLButtonElement;
  private session: DrawingSession;
  private timer: number | undefined;
  private resolve: ((r: DrawingResult) => void) | null = null;
  private pointerId: number | null = null;
  private loop: DrawLoop | null = null;
  private lastMove: { x: number; y: number; at: number } | null = null;
  private scars: Scar[] = [];
  private fogs: { x: number; y: number; r: number }[] = [];
  private muds: { x: number; y: number; r: number }[] = [];
  private readonly particles = new ElementParticles();
  /** Alan büyüsü önizlemesi (çok sık hesaplanmasın diye ~80 ms'de bir) */
  private areaPreview: { at: number; strokes: number; points: number; regions: AreaRegion[]; filled: Set<number> } | null = null;

  constructor(private readonly options: DrawingCanvasOptions) {
    this.session = new DrawingSession(options);

    this.element = document.createElement('div');
    this.element.className = 'flex w-full flex-col items-center gap-3 mobile:landscape:gap-1.5';
    this.element.innerHTML = `
      <canvas class="mb-draw touch-none rounded-lg border-2 ${options.overlay ? 'border-amber-200/30 bg-slate-950/25 backdrop-blur-[1px]' : 'border-amber-200/50 bg-slate-950'}" style="width:min(88vw,60vh);width:min(88vw,60dvh);aspect-ratio:1;touch-action:none"></canvas>
      <div class="mb-draw w-[min(88vw,60vh)] w-[min(88vw,60dvh)]">
        <div class="h-2 overflow-hidden rounded bg-white/10"><div data-fill class="h-full w-full bg-amber-300"></div></div>
        <div class="mt-2 flex items-center justify-between text-sm text-slate-300">
          <span data-label></span>
          <button data-finish type="button" class="rounded bg-white/10 px-3 py-1 hover:bg-white/20">Bitir</button>
        </div>
      </div>`;
    this.canvas = this.element.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.fill = this.element.querySelector('[data-fill]')!;
    this.label = this.element.querySelector('[data-label]')!;
    this.finishBtn = this.element.querySelector('[data-finish]')!;

    this.canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.onUp(e));
    this.finishBtn.addEventListener('click', () => this.end());
  }

  /** Turu başlatır; çizim bitince (süre dolunca, "Bitir" ile ya da hiç dokunulmazsa) sonucu verir. */
  start(): Promise<DrawingResult> {
    this.session = new DrawingSession(this.options);
    this.session.start(performance.now());
    this.scars = placeScars(Math.max(0, Math.floor(this.options.scars ?? 0)), this.options.random);
    this.fogs = placeFog(Math.max(0, Math.floor(this.options.fog ?? 0)), this.options.random);
    this.muds = placeMud(Math.max(0, Math.floor(this.options.mud ?? 0)), this.options.random);
    preloadTextures();
    this.fitCanvas();
    this.timer = window.setInterval(() => this.frame(), Math.min(DWELL_SAMPLE_MS, 16));
    this.frame();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  /** Turu sonuçsuz bırakır (örn. savaş bitti). */
  cancel(): void {
    window.clearInterval(this.timer);
    this.resolve = null;
  }

  private fitCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  private toLogical(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * LOGICAL_SIZE,
      y: ((e.clientY - rect.top) / rect.height) * LOGICAL_SIZE,
    };
  }

  private onDown(e: PointerEvent): void {
    if (!e.isPrimary || this.pointerId !== null || this.session.currentPhase === 'finished') return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Bazı tarayıcılar/cihazlar yakalamayı reddedebilir; çizim yine de çalışır
    }
    const p = this.toLogical(e);
    const now = performance.now();
    this.aim(e, true);
    this.session.pointerDown(p.x, p.y, now);
    this.loop = this.options.drawSound?.() ?? null;
    this.lastMove = { x: p.x, y: p.y, at: now };
  }

  /** Kalemin ekrandaki yerini (-1..1) ele bildirir (birinci kişi bakış) */
  private aim(e: PointerEvent, down: boolean): void {
    if (!this.options.onAim) return;
    const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    const ny = 1 - (e.clientY / Math.max(1, window.innerHeight)) * 2;
    this.options.onAim(nx, ny, down);
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) {
      // Basılı değilken de el imleci izler (fare)
      if (this.pointerId === null && e.pointerType === 'mouse') this.aim(e, false);
      return;
    }
    this.aim(e, true);
    const p = this.toLogical(e);
    const now = performance.now();
    // Çamur, sis ve yara izi yalnızca görüşü engeller: çizgiler her zaman kaydedilir
    this.session.pointerMove(p.x, p.y, now);
    if (this.options.element) {
      const sc = this.canvas.width / LOGICAL_SIZE;
      this.particles.emit(this.options.element, p.x * sc, p.y * sc, this.options.element === 'fire' ? 3 : 2, sc, BRUSH_RADIUS);
    }
    const last = this.lastMove;
    if (this.loop && last) {
      // mantıksal birim/ms; ~0.8 çok hızlı sayılır
      this.loop.update(Math.hypot(p.x - last.x, p.y - last.y) / Math.max(1, now - last.at) / 0.8);
    }
    this.lastMove = { x: p.x, y: p.y, at: now };
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.aim(e, false);
    this.stopSound();
    this.session.pointerUp(performance.now());
  }

  private stopSound(): void {
    this.loop?.end();
    this.loop = null;
    this.lastMove = null;
  }

  /** Her karede: süreyi ilerlet (basılı tutma örneği), çiz, bittiyse sonucu ver. */
  private frame(): void {
    const now = performance.now();
    this.session.tick(now);
    this.applyShake();
    // Kalem durduysa ses kısılır
    if (this.loop && this.lastMove && now - this.lastMove.at > 70) this.loop.update(0);
    this.render(now);
    if (this.session.currentPhase === 'finished') this.end();
  }

  /** Sarsıntı: tuvali her karede rastgele birkaç piksel oynatır (şiddet başına ~2.5 px). */
  private applyShake(): void {
    const amp = (this.options.shake ?? 0) * 2.5;
    if (amp <= 0 || this.session.currentPhase === 'finished') {
      this.canvas.style.transform = '';
      return;
    }
    const r = this.options.random ?? Math.random;
    this.canvas.style.transform = `translate(${((r() - 0.5) * 2 * amp).toFixed(1)}px, ${((r() - 0.5) * 2 * amp).toFixed(1)}px)`;
  }

  private end(): void {
    this.canvas.style.transform = '';
    window.clearInterval(this.timer);
    this.stopSound();
    const result = this.session.finish(performance.now());
    this.render(performance.now());
    this.finishBtn.disabled = true;
    const done = this.resolve;
    this.resolve = null;
    done?.(result);
  }

  /** Çizgileri verilen renkte çizer; `glow` açıksa parlama ekler. */
  private drawStrokes(strokes: readonly Stroke[], color: string, scale: number, glow: boolean): void {
    const { ctx } = this;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow ? 7 * scale : 0;
    ctx.lineWidth = BRUSH_RADIUS * 1.2 * scale;
    for (const stroke of strokes) {
      if (stroke.length === 0) continue;
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].x * scale, stroke[0].y * scale, BRUSH_RADIUS * 0.6 * scale, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * scale, stroke[0].y * scale);
      for (let k = 1; k < stroke.length; k++) ctx.lineTo(stroke[k].x * scale, stroke[k].y * scale);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  /** Çamur yamaları (Faz 4): gerçek çamur dokusu, ıslak koyu kenar ve parıltı; görüşü örter, çizimi engellemez. */
  private drawMud(scale: number, now: number): void {
    this.muds.forEach((m, i) => drawMudPatch(this.ctx, m.x * scale, m.y * scale, m.r * scale, i * 1.7 + m.x * 0.01, now));
  }

  /** Sis bulutları: altındaki çizimi ve hayaleti örter. */
  private drawFog(scale: number): void {
    const { ctx } = this;
    for (const f of this.fogs) {
      const g = ctx.createRadialGradient(f.x * scale, f.y * scale, f.r * 0.15 * scale, f.x * scale, f.y * scale, f.r * scale);
      g.addColorStop(0, 'rgba(186,230,253,0.92)');
      g.addColorStop(0.7, 'rgba(147,197,253,0.7)');
      g.addColorStop(1, 'rgba(147,197,253,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x * scale, f.y * scale, f.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Ateş yaraları (Faz 4): kömürleşmiş toprak dokulu yarık, içinde titreyen kor çatlaklar; görüşü örter, çizimi engellemez. */
  private drawScars(scale: number, now: number): void {
    for (const sc of this.scars) drawBurnScar(this.ctx, sc.x * scale, sc.y * scale, SCAR_RADIUS * 1.9 * scale, sc.angle, now, false);
  }

  /** Faz 6: kapalı bölgeler: dolacaklar yeşil, sığmayanlar kırmızı. */
  private drawArea(scale: number, now: number): void {
    const strokes = this.session.liveStrokes;
    const points = strokes.reduce((n, st) => n + st.length, 0);
    const prev = this.areaPreview;
    if (!prev || (now - prev.at > 80 && (prev.points !== points || prev.strokes !== strokes.length))) {
      const plan = areaPlan(buildDensity(strokes), this.options.areaCapacity ?? 0);
      this.areaPreview = { at: now, strokes: strokes.length, points, regions: plan.regions, filled: new Set(plan.filled) };
    }
    const { regions, filled } = this.areaPreview!;
    if (regions.length === 0) return;
    const { ctx } = this;
    const cell = CELL * scale;
    const pulse = 0.18 + 0.06 * Math.sin(now / 160);
    regions.forEach((r, i) => {
      ctx.fillStyle = filled.has(i) ? `rgba(74,222,128,${pulse + 0.1})` : `rgba(248,113,113,${pulse})`;
      // Tek yol: hücreler birleşik tek bir yüzey olarak boyanır (aralarında çizgi kalmaz)
      ctx.beginPath();
      for (const k of r.cells) ctx.rect((k % GRID) * cell, Math.floor(k / GRID) * cell, cell + 0.6, cell + 0.6);
      ctx.fill('nonzero');
    });
  }

  private render(now: number): void {
    const { ctx, canvas } = this;
    const scale = canvas.width / LOGICAL_SIZE;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Faz 1: ortadaki kılavuz artı kaldırıldı (tuvalin ortasında nokta gibi görünüyordu)

    if (this.options.target) paintSilhouette(this.ctx, this.options.target, scale, this.options.targetTone ?? 'enemy');
    if (this.options.ghost) this.drawStrokes(this.options.ghost, 'rgba(255,255,255,0.22)', scale, false);
    if (this.options.element) {
      // Faz 4: elementli kalem ve kalemin bıraktığı parçacıklar (alev, damla, çakıl, rüzgâr)
      drawElementStrokes(this.ctx, this.session.liveStrokes, this.options.element, scale, BRUSH_RADIUS * 1.2 * scale, now);
      this.particles.step(this.ctx);
    } else this.drawStrokes(this.session.liveStrokes, this.options.color, scale, true);
    // Görüşü engelleyenler çizginin ÜSTÜNE çizilir: yara izi, çamur ve sis çizilenin bir kısmını örter ama çizimi bozmaz
    if (this.options.areaCapacity !== undefined) this.drawArea(scale, now);
    this.drawScars(scale, now);
    this.drawMud(scale, now);
    this.drawFog(scale);

    const total = this.session.limitMs;
    const remaining = this.session.remainingMs(now);
    this.fill.style.width = `${(remaining / total) * 100}%`;
    this.fill.style.background = remaining < total * 0.25 ? '#f87171' : '#fcd34d';
    this.label.textContent =
      this.session.currentPhase === 'waiting'
        ? `Çizmeye başla! Süre ilk dokunuşta başlar (${(total / 1000).toFixed(0)} sn).`
        : this.session.currentPhase === 'finished'
          ? 'Çizim bitti.'
          : `${(remaining / 1000).toFixed(1)} sn`;
    if (this.options.areaCapacity !== undefined) this.label.textContent += ` · Alan gücü ${this.options.areaCapacity}`;
  }
}
