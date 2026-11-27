import type { Element } from '../battle/damage/elements';
import type { Stroke } from '../battle/gesture/types';
import mudUrl from '../assets/textures/brown_mud_02.jpg';
import burnedUrl from '../assets/textures/burned_ground_01.jpg';
import rockUrl from '../assets/textures/rock_06.jpg';

/**
 * Faz 4: elementlerin canlı görüntüsü (2D tuval). Element seçim ekranı, elementli kalem, çamur ve yanık izi buradan çizilir.
 * Dokular Poly Haven'dan CC0 (lisanssız): Brown Mud 02, Burned Ground 01, Rock 06 (Rob Tuytel), 256 piksele küçültüldü.
 */

// --- Dokular ----------------------------------------------------------------------------------

const images = new Map<string, HTMLImageElement>();
/** Dokuyu bir kez yükler; yüklenene kadar `null` döner (çizen taraf düz renkle idare eder). */
function texture(url: string): HTMLImageElement | null {
  let img = images.get(url);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = url;
    images.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
export const TEXTURES = { mud: mudUrl, burned: burnedUrl, rock: rockUrl } as const;
/** Dokuları erkenden yüklemeye başlar (ilk çizimde boş görünmesin). */
export function preloadTextures(): void {
  for (const url of Object.values(TEXTURES)) texture(url);
}

function pattern(ctx: CanvasRenderingContext2D, url: string, scale = 1): CanvasPattern | null {
  const img = texture(url);
  if (!img) return null;
  const p = ctx.createPattern(img, 'repeat');
  if (p && scale !== 1 && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix().scale(scale));
  return p;
}

// --- Parçacıklar ------------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  kind: Element;
  spin: number;
}

/** Elementin parçacıkları: alev (yükselir, söner), su (damla ve kabarcık), toprak (çakıl düşer), hava (rüzgâr kıvrımı savrulur). */
export class ElementParticles {
  private list: Particle[] = [];
  constructor(private readonly cap = 260) {}

  get count(): number {
    return this.list.length;
  }

  /** (x, y) noktasında `n` parçacık; `spread` çevreye dağılma, `scale` piksel çarpanı. */
  emit(kind: Element, x: number, y: number, n: number, scale = 1, spread = 6): void {
    for (let i = 0; i < n && this.list.length < this.cap; i++) {
      const r = Math.random;
      const base = { x: x + (r() - 0.5) * spread * scale, y: y + (r() - 0.5) * spread * scale, kind, spin: r() * Math.PI * 2 };
      switch (kind) {
        case 'fire':
          this.list.push({ ...base, vx: (r() - 0.5) * 0.6 * scale, vy: -(0.8 + r() * 1.6) * scale, life: 0, max: 26 + r() * 22, size: (3 + r() * 5) * scale });
          break;
        case 'water':
          this.list.push({ ...base, vx: (r() - 0.5) * 0.9 * scale, vy: (r() < 0.5 ? -0.6 : 0.5) * (0.5 + r()) * scale, life: 0, max: 30 + r() * 30, size: (1.5 + r() * 3.5) * scale });
          break;
        case 'earth':
          this.list.push({ ...base, vx: (r() - 0.5) * 1.4 * scale, vy: -(0.4 + r() * 1.2) * scale, life: 0, max: 34 + r() * 20, size: (1.5 + r() * 3) * scale });
          break;
        case 'air':
          this.list.push({ ...base, vx: (1 + r() * 2) * scale * (r() < 0.5 ? -1 : 1), vy: (r() - 0.5) * 0.6 * scale, life: 0, max: 28 + r() * 26, size: (6 + r() * 10) * scale });
          break;
      }
    }
  }

  /** Bir adım ilerletir ve çizer. */
  step(ctx: CanvasRenderingContext2D): void {
    const keep: Particle[] = [];
    for (const p of this.list) {
      p.life++;
      if (p.life >= p.max) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += 0.15;
      if (p.kind === 'earth') p.vy += 0.09; // yerçekimi
      if (p.kind === 'fire') p.vx += (Math.random() - 0.5) * 0.15;
      if (p.kind === 'air') p.vy += Math.sin(p.spin) * 0.05;
      keep.push(p);
      this.drawOne(ctx, p);
    }
    this.list = keep;
  }

  private drawOne(ctx: CanvasRenderingContext2D, p: Particle): void {
    const t = p.life / p.max;
    ctx.save();
    switch (p.kind) {
      case 'fire': {
        ctx.globalCompositeOperation = 'lighter';
        const s = p.size * (1 - t * 0.7);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
        g.addColorStop(0, `rgba(255,${Math.round(240 - 120 * t)},${Math.round(150 - 150 * t)},${0.9 * (1 - t)})`);
        g.addColorStop(0.5, `rgba(255,${Math.round(120 - 80 * t)},20,${0.55 * (1 - t)})`);
        g.addColorStop(1, 'rgba(180,20,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'water': {
        ctx.globalAlpha = 0.8 * (1 - t);
        ctx.strokeStyle = 'rgba(190,230,255,0.95)';
        ctx.fillStyle = 'rgba(90,170,255,0.35)';
        ctx.lineWidth = Math.max(0.8, p.size * 0.3);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.25, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'earth': {
        ctx.globalAlpha = 1 - t * t;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.size > 3 ? '#6b4a2b' : '#8a6a45';
        ctx.beginPath();
        ctx.moveTo(-p.size, -p.size * 0.6);
        ctx.lineTo(p.size * 0.8, -p.size);
        ctx.lineTo(p.size, p.size * 0.7);
        ctx.lineTo(-p.size * 0.6, p.size);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'air': {
        ctx.globalAlpha = 0.55 * Math.sin(Math.PI * t);
        ctx.strokeStyle = 'rgba(240,248,255,0.95)';
        ctx.lineWidth = Math.max(1, p.size * 0.12);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, p.spin, p.spin + Math.PI * 1.2);
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }
}

// --- Elementli kalem --------------------------------------------------------------------------

const PEN: Record<Element, { glow: string; core: string; edge: string }> = {
  fire: { glow: 'rgba(255,110,20,0.95)', core: '#fff1b8', edge: '#ff7a1a' },
  water: { glow: 'rgba(60,150,255,0.9)', core: '#d9f1ff', edge: '#2f8cff' },
  earth: { glow: 'rgba(120,80,40,0.7)', core: '#b08455', edge: '#5b3b1f' },
  air: { glow: 'rgba(230,245,255,0.8)', core: '#ffffff', edge: '#cfe6f5' },
};

function path(ctx: CanvasRenderingContext2D, stroke: Stroke, scale: number, ox = 0, oy = 0): void {
  ctx.beginPath();
  ctx.moveTo((stroke[0].x + ox) * scale, (stroke[0].y + oy) * scale);
  for (let k = 1; k < stroke.length; k++) ctx.lineTo((stroke[k].x + ox) * scale, (stroke[k].y + oy) * scale);
}

/**
 * Çizgileri elementin kalemiyle çizer: ateş parlak çekirdekli alev, su parlayan mavi akış, toprak kaya dokulu kalın iz, hava ince
 * rüzgâr telleri. `width` kalem kalınlığı (piksel), `time` animasyon için (ms).
 */
export function drawElementStrokes(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[], element: Element, scale: number, width: number, time: number): void {
  const pen = PEN[element];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (s.length === 0) continue;
    if (s.length === 1) {
      ctx.fillStyle = pen.edge;
      ctx.beginPath();
      ctx.arc(s[0].x * scale, s[0].y * scale, width * 0.5, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    switch (element) {
      case 'fire': {
        const flicker = 0.85 + 0.15 * Math.sin(time / 60);
        ctx.shadowColor = pen.glow;
        ctx.shadowBlur = 14 * scale * flicker;
        ctx.strokeStyle = pen.edge;
        ctx.lineWidth = width;
        path(ctx, s, scale);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffc24a';
        ctx.lineWidth = width * 0.6;
        ctx.stroke();
        ctx.strokeStyle = pen.core;
        ctx.lineWidth = width * 0.25;
        ctx.stroke();
        break;
      }
      case 'water': {
        ctx.shadowColor = pen.glow;
        ctx.shadowBlur = 9 * scale;
        ctx.strokeStyle = pen.edge;
        ctx.lineWidth = width;
        path(ctx, s, scale);
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Akan parıltı: kesik çizgi zamanla kayar
        ctx.strokeStyle = pen.core;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = width * 0.28;
        ctx.setLineDash([6 * scale, 9 * scale]);
        ctx.lineDashOffset = -time / 25;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        break;
      }
      case 'earth': {
        ctx.strokeStyle = pen.edge;
        ctx.lineWidth = width * 1.1;
        path(ctx, s, scale);
        ctx.stroke();
        ctx.strokeStyle = pattern(ctx, TEXTURES.rock, 0.35 * scale) ?? pen.core;
        ctx.lineWidth = width * 0.85;
        ctx.stroke();
        break;
      }
      case 'air': {
        ctx.shadowColor = pen.glow;
        ctx.shadowBlur = 8 * scale;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = width;
        path(ctx, s, scale);
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Rüzgâr telleri: çizginin yanında kayan ince çizgiler
        for (let k = -1; k <= 1; k++) {
          ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.2 * k})`;
          ctx.lineWidth = Math.max(1, width * 0.12);
          ctx.setLineDash([10 * scale, 14 * scale]);
          ctx.lineDashOffset = -time / (14 + k * 4);
          path(ctx, s, scale, k * width * 0.18 / scale, k * width * 0.18 / scale);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        break;
      }
    }
  }
  ctx.restore();
}

// --- Çamur ve yanık izi ------------------------------------------------------------------------

/** Pürüzlü yuvarlak yol (çamur birikintisi) */
function blobPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number): void {
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.82 + 0.18 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 7 + seed * 2);
    const px = x + Math.cos(a) * r * k;
    const py = y + Math.sin(a) * r * k;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Çamur yaması: gerçek çamur dokusu, koyu ıslak kenar ve parlak ıslaklık; içine çizilen görünmez. (Piksel koordinatı) */
export function drawMudPatch(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, time: number): void {
  ctx.save();
  blobPath(ctx, x, y, r, seed);
  ctx.fillStyle = pattern(ctx, TEXTURES.mud, Math.max(0.2, r / 220)) ?? '#5c4026';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = r * 0.25;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.clip();
  // Koyu ıslak kenar ve üstte parlaklık
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
  g.addColorStop(0, 'rgba(40,25,10,0.05)');
  g.addColorStop(1, 'rgba(25,14,5,0.65)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 0.25 + 0.08 * Math.sin(time / 500 + seed);
  ctx.fillStyle = '#fff3df';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.25, y - r * 0.35, r * 0.35, r * 0.12, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Ateş yarası (yanık izi): kömürleşmiş toprak dokulu yarık, içinde titreyen kor çatlaklar ve tüten duman. (Piksel koordinatı) */
export function drawBurnScar(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, time: number, faded: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = faded ? 0.35 : 1;
  // Yanık leke: uzun pürüzlü elips
  ctx.beginPath();
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.75 + 0.25 * Math.abs(Math.sin(a * 4 + len));
    const px = Math.cos(a) * len * k;
    const py = Math.sin(a) * len * 0.32 * k;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = pattern(ctx, TEXTURES.burned, Math.max(0.2, len / 260)) ?? '#2b1d16';
  ctx.shadowColor = 'rgba(255,90,20,0.6)';
  ctx.shadowBlur = len * 0.35;
  ctx.fill();
  ctx.shadowBlur = 0;
  // Kor çatlaklar
  const flicker = 0.6 + 0.4 * Math.sin(time / 90 + len);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,${Math.round(120 + 60 * flicker)},40,${(faded ? 0.3 : 0.85) * flicker})`;
  ctx.lineWidth = Math.max(1.5, len * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-len * 0.8, 0);
  ctx.lineTo(-len * 0.3, -len * 0.08);
  ctx.lineTo(len * 0.1, len * 0.06);
  ctx.lineTo(len * 0.75, -len * 0.04);
  ctx.moveTo(-len * 0.1, len * 0.02);
  ctx.lineTo(len * 0.05, len * 0.2);
  ctx.stroke();
  ctx.restore();
}

// --- Tam ekran element seçimi --------------------------------------------------------------

/** Ekranın dört bölmesi: ateş sol üst, su sağ üst, toprak sol alt, hava sağ alt */
export const QUADRANTS: readonly Element[] = ['fire', 'water', 'earth', 'air'];

/** Bölmenin dikdörtgeni (piksel) */
function quadRect(i: number, w: number, h: number): { x: number; y: number; w: number; h: number } {
  const hw = w / 2;
  const hh = h / 2;
  return { x: (i % 2) * hw, y: Math.floor(i / 2) * hh, w: hw, h: hh };
}

/** Bir bölmenin canlı arka planı (her karede): alev alev ateş, dalgalı su, kayalık toprak, esen rüzgâr. */
function paintQuadrant(ctx: CanvasRenderingContext2D, el: Element, r: { x: number; y: number; w: number; h: number }, time: number, fx: ElementParticles, dpr: number, hover: boolean): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  const t = time / 1000;
  switch (el) {
    case 'fire': {
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, '#1a0503');
      g.addColorStop(0.6, '#5a1206');
      g.addColorStop(1, '#b83a0c');
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      const ground = pattern(ctx, TEXTURES.burned, 0.6 * dpr);
      if (ground) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = ground;
        ctx.fillRect(r.x, r.y + r.h * 0.82, r.w, r.h * 0.18);
        ctx.globalAlpha = 1;
      }
      // Alevler: tabandan sürekli yükselen parçacıklar
      for (let i = 0; i < 5; i++) fx.emit('fire', r.x + Math.random() * r.w, r.y + r.h * (0.86 + Math.random() * 0.1), 1, dpr * 2.4, 4);
      break;
    }
    case 'water': {
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, '#08213f');
      g.addColorStop(1, '#0c5fa8');
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // Üç katman dalga
      for (let k = 0; k < 3; k++) {
        const base = r.y + r.h * (0.35 + k * 0.2);
        const amp = r.h * (0.04 + 0.015 * k);
        ctx.fillStyle = `rgba(${80 + k * 30},${160 + k * 25},255,${0.18 + k * 0.08})`;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y + r.h);
        for (let x = 0; x <= r.w; x += 6 * dpr) {
          const y = base + Math.sin(x / (r.w * 0.18) + t * (1.4 + k * 0.5) + k) * amp + Math.sin(x / (r.w * 0.07) - t * 2) * amp * 0.3;
          ctx.lineTo(r.x + x, y);
        }
        ctx.lineTo(r.x + r.w, r.y + r.h);
        ctx.closePath();
        ctx.fill();
      }
      if (Math.random() < 0.5) fx.emit('water', r.x + Math.random() * r.w, r.y + r.h * 0.95, 1, dpr * 2.2, 2);
      break;
    }
    case 'earth': {
      const rock = pattern(ctx, TEXTURES.rock, 0.9 * dpr);
      ctx.fillStyle = rock ?? '#5b4630';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      const v = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.1, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.75);
      v.addColorStop(0, 'rgba(60,35,10,0.05)');
      v.addColorStop(1, 'rgba(20,10,0,0.7)');
      ctx.fillStyle = v;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // Kayalar ve toprak dökülür
      if (Math.random() < 0.35) fx.emit('earth', r.x + Math.random() * r.w, r.y + r.h * 0.1, 2, dpr * 2.5, 10);
      break;
    }
    case 'air': {
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, '#cfe7f7');
      g.addColorStop(1, '#8fb8d6');
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // Rüzgâr çizgileri: kayan kıvrımlar
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineCap = 'round';
      for (let k = 0; k < 7; k++) {
        const y0 = r.y + r.h * ((k + 0.5) / 7);
        const phase = ((t * (0.35 + k * 0.07) + k * 0.37) % 1.4) - 0.2;
        const x0 = r.x + phase * r.w;
        ctx.lineWidth = (1.5 + (k % 3)) * dpr;
        ctx.globalAlpha = 0.35 + 0.4 * Math.sin(Math.PI * Math.min(1, Math.max(0, phase)));
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(x0 + r.w * 0.15, y0 - r.h * 0.05, x0 + r.w * 0.25, y0 + r.h * 0.05, x0 + r.w * 0.4, y0);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (Math.random() < 0.3) fx.emit('air', r.x, r.y + Math.random() * r.h, 1, dpr * 2, 4);
      break;
    }
  }
  if (hover) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.restore();
}

/**
 * Faz 4: tam ekran element seçimi. Ekran dörde bölünür (ateş, su, toprak, hava); her bölme canlıdır. Yazı yok (yalnız görüntü);
 * erişilebilirlik için her bölmenin görünmez bir düğmesi ve adı vardır. Bir bölmeye dokununca o element seçilir.
 * `names`: ekran okuyucu için element adları.
 */
export function chooseElementFullScreen(host: HTMLElement, names: Record<Element, string>): Promise<Element> {
  preloadTextures();
  host.innerHTML = `<div class="relative h-full w-full">
      <canvas class="absolute inset-0 h-full w-full"></canvas>
      <div class="absolute inset-0 grid grid-cols-2 grid-rows-2">
        ${QUADRANTS.map((e) => `<button type="button" data-element="${e}" aria-label="${names[e]}" class="h-full w-full bg-transparent outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white/70"></button>`).join('')}
      </div>
      <div class="pointer-events-none absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 bg-black/50"></div>
      <div class="pointer-events-none absolute left-1/2 top-1/2 h-full w-px -translate-y-1/2 bg-black/50"></div>
    </div>`;
  const canvas = host.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const fx = new ElementParticles(420);
  let hover = -1;
  let raf = 0;
  const fit = (): number => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    return dpr;
  };
  let dpr = fit();
  const frame = (now: number): void => {
    if (canvas.width !== Math.round(canvas.getBoundingClientRect().width * dpr)) dpr = fit();
    QUADRANTS.forEach((el, i) => paintQuadrant(ctx, el, quadRect(i, canvas.width, canvas.height), now, fx, dpr, i === hover));
    fx.step(ctx);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return new Promise((resolve) => {
    host.querySelectorAll<HTMLButtonElement>('[data-element]').forEach((b, i) => {
      b.addEventListener('pointerenter', () => (hover = i));
      b.addEventListener('pointerleave', () => (hover = -1));
      b.addEventListener('click', () => {
        hover = i;
        b.animate([{ background: 'rgba(255,255,255,0.45)' }, { background: 'rgba(255,255,255,0)' }], { duration: 260 });
        window.setTimeout(() => {
          cancelAnimationFrame(raf);
          host.innerHTML = '';
          resolve(QUADRANTS[i]);
        }, 220);
      });
    });
  });
}
