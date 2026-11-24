/**
 * Açılış animasyonu: yıldızlı bir gecede bir asa ucu altın ışıkla "dorukplays" yazısını çizer, ardından
 * "sunar" belirir ve yazı ekrana doğru büyüyerek dağılır, arkasından oyun açılır.
 *
 * - Tıklama, dokunma ya da herhangi bir tuş animasyonu hızla bitirir.
 * - Aynı sekmede bir kez gösterilir (yeniden yüklemede tekrar oynamaz); `?intro=1` her zaman oynatır.
 * - "Hareketi azalt" tercihi açıksa yalnızca kısa bir solma gösterilir.
 */

const SEEN_KEY = 'mb-intro-seen';
const FONT = "italic 700 150px Georgia, 'Palatino Linotype', 'Book Antiqua', serif";

/** Zaman çizelgesi (ms) */
const T = {
  stars: 350, // yıldızlar belirir
  drawEnd: 2550, // "dorukplays" çizimi biter
  fillEnd: 3150, // yazı altınla dolar
  subStart: 2900, // "sunar" başlar
  subEnd: 3700,
  zoomStart: 4250, // ekrana doğru gelme
  end: 5150,
};

const SVG_NS = 'http://www.w3.org/2000/svg';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  hue: number;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t: number): number => 1 - (1 - t) ** 3;
const easeIn = (t: number): number => t * t * t;

function shouldPlay(): boolean {
  const params = new URLSearchParams(location.search);
  if (params.get('intro') === '1') return true;
  if (params.get('intro') === '0') return false;
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return false;
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Depolama kapalıysa her açılışta oynar; sorun değil
  }
  return true;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Animasyonu oynatır; bitince (ya da gösterilmeyecekse hemen) çözülür. */
export function playIntro(): Promise<void> {
  if (!shouldPlay()) return Promise.resolve();
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const root = document.createElement('div');
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', 'dorukplays sunar');
  root.style.cssText =
    'position:fixed;inset:0;z-index:200;overflow:hidden;cursor:pointer;' +
    'background:radial-gradient(ellipse at 50% 55%, #2a1d4d 0%, #141030 45%, #07060f 100%);';

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  root.appendChild(canvas);

  // --- Yazı (SVG) ---------------------------------------------------------------------------
  const stage = document.createElement('div');
  stage.style.cssText =
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;' +
    'transform-origin:50% 50%;will-change:transform,opacity,filter;';
  const svg = svgEl('svg', { viewBox: '0 0 1000 420', width: '100%', height: '100%', 'aria-hidden': 'true' });
  svg.style.cssText = 'max-width:min(92vw,1100px);max-height:70vh;overflow:visible;';

  const defs = svgEl('defs', {});
  defs.innerHTML = `
    <linearGradient id="mbGold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff3c4"/>
      <stop offset="0.45" stop-color="#f3c552"/>
      <stop offset="1" stop-color="#b8741f"/>
    </linearGradient>
    <filter id="mbGlow" x="-30%" y="-60%" width="160%" height="220%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="mbStrokeClip"><rect x="0" y="0" width="0" height="420"/></clipPath>
    <clipPath id="mbFillClip"><rect x="0" y="0" width="0" height="420"/></clipPath>
    <clipPath id="mbSubClip"><rect x="0" y="0" width="0" height="420"/></clipPath>`;
  svg.appendChild(defs);
  const strokeClip = defs.querySelector('#mbStrokeClip rect')!;
  const fillClip = defs.querySelector('#mbFillClip rect')!;
  const subClip = defs.querySelector('#mbSubClip rect')!;

  const textAttrs = { x: 500, y: 215, 'text-anchor': 'middle', 'font-style': 'italic', 'font-weight': 700, 'font-size': 150 };
  const family = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";

  const fillText = svgEl('text', { ...textAttrs, fill: 'url(#mbGold)', 'clip-path': 'url(#mbFillClip)' });
  fillText.style.fontFamily = family;
  fillText.textContent = 'dorukplays';
  fillText.style.opacity = '0';

  const strokeText = svgEl('text', {
    ...textAttrs,
    fill: 'none',
    stroke: '#ffe8a3',
    'stroke-width': 2.6,
    'stroke-linejoin': 'round',
    'clip-path': 'url(#mbStrokeClip)',
  });
  strokeText.style.fontFamily = family;
  strokeText.textContent = 'dorukplays';

  const subText = svgEl('text', {
    x: 500,
    y: 312,
    'text-anchor': 'middle',
    'font-size': 58,
    'letter-spacing': 22,
    fill: '#e9d9ff',
    'clip-path': 'url(#mbSubClip)',
  });
  subText.style.fontFamily = family;
  subText.textContent = 'sunar';

  // Yazının altındaki ince büyü çizgisi
  const flourish = svgEl('path', {
    d: 'M 230 250 C 380 280, 620 280, 770 250',
    fill: 'none',
    stroke: '#c9a8ff',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    filter: 'url(#mbGlow)',
  });

  // Işıma, kırpılmış yazıyı saran grupta uygulanır; böylece kırpma kenarı ışımayı kesmez
  const glowWrap = (el: SVGElement): SVGGElement => {
    const g = svgEl('g', { filter: 'url(#mbGlow)' });
    g.appendChild(el);
    return g;
  };
  svg.append(flourish, glowWrap(fillText), glowWrap(strokeText), glowWrap(subText));
  stage.appendChild(svg);
  root.appendChild(stage);

  const hint = document.createElement('div');
  hint.textContent = 'Geç ›';
  hint.style.cssText =
    'position:absolute;right:16px;bottom:14px;font:14px system-ui,sans-serif;color:rgba(233,217,255,.55);' +
    'letter-spacing:.05em;pointer-events:none;transition:opacity .4s;';
  root.appendChild(hint);

  document.body.appendChild(root);

  // Ölçüler yazı tipi yüklendikten sonra alınır
  let box = { x: 160, y: 110, width: 680, height: 140 };
  let subBox = { x: 330, y: 265, width: 340, height: 60 };
  let flourishLen = 560;
  const measure = (): void => {
    try {
      const b = strokeText.getBBox();
      if (b.width > 0) box = { x: b.x, y: b.y, width: b.width, height: b.height };
      const s = subText.getBBox();
      if (s.width > 0) subBox = { x: s.x, y: s.y, width: s.width, height: s.height };
      flourishLen = flourish.getTotalLength();
    } catch {
      // ölçülemezse varsayılanlar kullanılır
    }
    flourish.setAttribute('stroke-dasharray', String(flourishLen));
    flourish.setAttribute('stroke-dashoffset', String(flourishLen));
  };
  measure();
  void document.fonts?.load(FONT).then(measure, () => undefined);

  // --- Tuval (yıldızlar ve kıvılcımlar) -----------------------------------------------------
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let W = 0;
  let H = 0;
  const resize = (): void => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = root.clientWidth;
    H = root.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };
  resize();
  window.addEventListener('resize', resize);

  const stars = Array.from({ length: Math.round(Math.min(180, (W * H) / 7000)) }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.4 + 0.3,
    phase: Math.random() * Math.PI * 2,
    speed: 0.6 + Math.random() * 1.8,
  }));
  const sparks: Spark[] = [];

  /** SVG koordinatını ekran koordinatına çevirir */
  const toScreen = (x: number, y: number): { x: number; y: number } => {
    const m = svg.getScreenCTM();
    if (!m) return { x: W / 2, y: H / 2 };
    const rootRect = root.getBoundingClientRect();
    return { x: m.a * x + m.c * y + m.e - rootRect.left, y: m.b * x + m.d * y + m.f - rootRect.top };
  };

  const emit = (x: number, y: number, n: number, spread: number, speed: number, hueBase: number): void => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.3 + Math.random()) * speed;
      sparks.push({
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.25,
        life: 0,
        max: 500 + Math.random() * 700,
        size: 0.8 + Math.random() * 2.2,
        hue: hueBase + Math.random() * 30,
      });
    }
  };

  // --- Zaman çizelgesi ------------------------------------------------------------------------
  return new Promise<void>((resolve) => {
    let start = performance.now();
    let last = start;
    let skipped = false;
    let burstDone = false;
    let finished = false;

    const finish = (): void => {
      if (finished) return;
      finished = true;
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', skip, true);
      root.remove();
      resolve();
    };

    /** Atla: çizimi tamamla ve doğrudan ekrana gelme bölümüne geç */
    function skip(): void {
      if (skipped || finished) return;
      skipped = true;
      const now = performance.now();
      const elapsed = now - start;
      if (elapsed < T.zoomStart) start = now - T.zoomStart; // zaman çizelgesini ileri sar
    }
    root.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip, true);

    if (reduced) {
      // Kısa, hareketsiz gösterim
      strokeClip.setAttribute('width', '1000');
      fillClip.setAttribute('width', '1000');
      subClip.setAttribute('width', '1000');
      fillText.style.opacity = '1';
      flourish.setAttribute('stroke-dashoffset', '0');
      root.style.transition = 'opacity .5s';
      setTimeout(() => (root.style.opacity = '0'), 1300);
      setTimeout(finish, 1850);
      root.addEventListener('pointerdown', () => (root.style.opacity = '0'));
      return;
    }

    const frame = (now: number): void => {
      if (finished) return;
      const t = now - start;
      const dt = Math.min(50, now - last);
      last = now;

      // Çizim ilerlemesi
      const drawP = easeInOut(clamp01((t - T.stars) / (T.drawEnd - T.stars)));
      const sweep = box.x - 10 + drawP * (box.width + 20);
      strokeClip.setAttribute('x', String(box.x - 20));
      strokeClip.setAttribute('width', String(Math.max(0, sweep - (box.x - 20))));

      const fillP = clamp01((t - (T.stars + 500)) / (T.fillEnd - T.stars - 500));
      fillClip.setAttribute('x', String(box.x - 20));
      fillClip.setAttribute('width', String(Math.max(0, box.x - 20 + easeInOut(fillP) * (box.width + 40) - (box.x - 20))));
      fillText.style.opacity = String(clamp01(fillP * 1.6));

      // Asa ucu: yazının üzerinde dalgalanarak soldan sağa ilerler
      const drawing = t > T.stars && t < T.drawEnd + 80;
      let tip: { x: number; y: number } | null = null;
      if (drawing) {
        const wobble = Math.sin(drawP * Math.PI * 19) * 0.32 + Math.sin(drawP * Math.PI * 7.3) * 0.12;
        const ty = box.y + box.height * (0.56 + wobble);
        tip = toScreen(Math.min(sweep, box.x + box.width), ty);
        emit(tip.x, tip.y, 3, 6, 0.09, 38);
      }

      // Alt çizgi ve "sunar"
      const flP = easeOut(clamp01((t - (T.drawEnd - 300)) / 700));
      flourish.setAttribute('stroke-dashoffset', String(flourishLen * (1 - flP)));
      const subP = easeInOut(clamp01((t - T.subStart) / (T.subEnd - T.subStart)));
      subClip.setAttribute('x', String(subBox.x - 30));
      subClip.setAttribute('width', String(subP * (subBox.width + 60)));
      if (subP > 0 && subP < 1 && Math.random() < 0.7) {
        const p = toScreen(subBox.x - 30 + subP * (subBox.width + 60), subBox.y + subBox.height * 0.6);
        emit(p.x, p.y, 2, 10, 0.06, 265);
      }

      // Bekleme anında yazı hafifçe nefes alır
      const pulse = t > T.fillEnd && t < T.zoomStart ? 1 + Math.sin((t - T.fillEnd) / 160) * 0.012 : 1;

      // Ekrana doğru gelme
      const zP = clamp01((t - T.zoomStart) / (T.end - T.zoomStart));
      const z = easeIn(zP);
      stage.style.transform = `scale(${(pulse * (1 + z * 11)).toFixed(4)})`;
      stage.style.opacity = String(1 - clamp01((zP - 0.35) / 0.65));
      stage.style.filter = zP > 0 ? `blur(${(z * 10).toFixed(2)}px)` : '';
      root.style.background =
        zP > 0
          ? `radial-gradient(ellipse at 50% 55%, rgba(42,29,77,${1 - z}) 0%, rgba(20,16,48,${1 - z}) 45%, rgba(7,6,15,${1 - z}) 100%)`
          : root.style.background;
      hint.style.opacity = zP > 0 ? '0' : t > 600 ? '1' : '0';

      if (zP > 0 && !burstDone) {
        burstDone = true;
        emit(W / 2, H / 2, 160, Math.min(W, H) * 0.35, 0.55, 30);
        emit(W / 2, H / 2, 70, Math.min(W, H) * 0.25, 0.4, 260);
      }

      // --- tuval çizimi ---
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const starAlpha = clamp01(t / T.stars) * (1 - z);
        for (const s of stars) {
          const tw = 0.55 + 0.45 * Math.sin(s.phase + (t / 1000) * s.speed);
          ctx.globalAlpha = starAlpha * tw * 0.9;
          ctx.fillStyle = '#efe6ff';
          // Yıldızlar da gelme anında merkezden dışa kayar
          const sx = W / 2 + (s.x * W - W / 2) * (1 + z * 2.5);
          const sy = H / 2 + (s.y * H - H / 2) * (1 + z * 2.5);
          ctx.beginPath();
          ctx.arc(sx, sy, s.r * (1 + z * 2), 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalCompositeOperation = 'lighter';
        for (let i = sparks.length - 1; i >= 0; i--) {
          const p = sparks[i];
          p.life += dt;
          if (p.life >= p.max) {
            sparks.splice(i, 1);
            continue;
          }
          // Gelme anında kıvılcımlar izleyiciye doğru büyür ve hızlanır
          const boost = zP > 0 ? 1 + z * 3 : 1;
          p.x += p.vx * dt * boost;
          p.y += p.vy * dt * boost;
          p.vy += 0.00012 * dt; // hafif yerçekimi
          const k = 1 - p.life / p.max;
          const r = p.size * (0.6 + k) * (zP > 0 ? 1 + z * 2 : 1);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
          g.addColorStop(0, `hsla(${p.hue},100%,85%,${k})`);
          g.addColorStop(1, `hsla(${p.hue},100%,60%,0)`);
          ctx.globalAlpha = 1;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        if (tip) {
          const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 26);
          g.addColorStop(0, 'rgba(255,255,240,1)');
          g.addColorStop(0.25, 'rgba(255,220,130,.85)');
          g.addColorStop(1, 'rgba(255,190,80,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 26, 0, Math.PI * 2);
          ctx.fill();
        }

        // Son anda kısa beyaz parlama
        if (zP > 0.55) {
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = Math.sin(((zP - 0.55) / 0.45) * Math.PI) * 0.35;
          ctx.fillStyle = '#fff6dd';
          ctx.fillRect(0, 0, W, H);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }

      if (t >= T.end) {
        root.style.transition = 'opacity .25s';
        root.style.opacity = '0';
        setTimeout(finish, 260);
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
