import { getSoundEngine, type DrawLoop } from '../audio/sfx/engine';
import type { SoundName } from '../audio/sfx/recipes';
import { ELEMENT_NAMES, ELEMENTS, type Element } from '../battle/damage/elements';
import { createSoundToggle } from './soundToggle';
import { lockTouchScroll } from './touchLock';

const ELEMENT_COLORS: Record<Element, string> = { fire: '#ff7a3d', water: '#4db8ff', earth: '#c8a15a', air: '#d6efff' };

/**
 * Ses laboratuvarı (`?lab=sound`): bütün büyü seslerini tek tek dinle. Ses koddan üretildiği için
 * (dosya yok) tonları ve seviyeleri burada kulakla ayarlayabilirsin.
 */
export function startSoundLab(root: HTMLElement): void {
  lockTouchScroll();
  const engine = getSoundEngine();
  let intensity = 0.6;

  root.innerHTML = '';
  const page = document.createElement('div');
  page.setAttribute('data-scrollable', '');
  page.style.touchAction = 'pan-y';
  page.className = 'fixed inset-0 overflow-y-auto bg-slate-950 text-amber-50';
  root.appendChild(page);
  root.appendChild(createSoundToggle(engine));

  const btn = (label: string, onClick: () => void, color?: string): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = `rounded px-3 py-2 text-sm font-bold active:scale-95 ${color ? 'text-slate-900' : 'bg-slate-700 text-amber-50'}`;
    if (color) b.style.background = color;
    b.addEventListener('click', () => {
      engine.unlock(); // bu dokunuş sesi açar
      onClick();
    });
    return b;
  };

  const section = (title: string, ...children: HTMLElement[]): HTMLElement => {
    const s = document.createElement('section');
    s.className = 'rounded-lg bg-slate-900 p-3';
    const h = document.createElement('h2');
    h.className = 'mb-2 text-sm font-bold text-amber-200';
    h.textContent = title;
    const row = document.createElement('div');
    row.className = 'flex flex-wrap gap-2';
    row.append(...children);
    s.append(h, row);
    return s;
  };

  const play = (name: SoundName, options: { element?: Element; intensity?: number } = {}) => (): void => engine.play(name, options);

  // Hasar şiddeti ve ses seviyesi
  const slider = (label: string, value: number, onInput: (v: number) => void): HTMLElement => {
    const wrap = document.createElement('label');
    wrap.className = 'flex flex-col gap-1 text-xs text-slate-300';
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.05';
    input.value = String(value);
    input.addEventListener('input', () => onInput(Number(input.value)));
    wrap.appendChild(input);
    return wrap;
  };

  const controls = document.createElement('div');
  controls.className = 'grid grid-cols-2 gap-3 rounded-lg bg-slate-900 p-3';
  controls.append(
    slider('Ses seviyesi', engine.currentVolume, (v) => {
      engine.unlock();
      engine.setVolume(v);
    }),
    slider('Vuruş şiddeti (hasar)', intensity, (v) => (intensity = v)),
  );

  // Kalem pedi: parmağı ya da fareyi gezdir, hıza göre değişen çizim sesini duy
  const pad = document.createElement('div');
  pad.className = 'flex h-32 touch-none items-center justify-center rounded-lg border border-dashed border-amber-200/40 text-sm text-slate-400 select-none';
  pad.style.touchAction = 'none';
  pad.textContent = 'Çizim sesi: buraya basılı tutup hareket ettir';
  let padElement: Element = 'fire';
  let loop: DrawLoop | null = null;
  let last: { x: number; y: number; t: number } | null = null;
  pad.addEventListener('pointerdown', (e) => {
    engine.unlock();
    pad.setPointerCapture(e.pointerId);
    loop = engine.beginDraw(padElement);
    last = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  pad.addEventListener('pointermove', (e) => {
    if (!loop || !last) return;
    const now = performance.now();
    const v = Math.hypot(e.clientX - last.x, e.clientY - last.y) / Math.max(1, now - last.t);
    loop.update(v / 1.2);
    last = { x: e.clientX, y: e.clientY, t: now };
  });
  const stop = (): void => {
    loop?.end();
    loop = null;
  };
  pad.addEventListener('pointerup', stop);
  pad.addEventListener('pointercancel', stop);

  const padChips = ELEMENTS.map((e) =>
    btn(ELEMENT_NAMES[e], () => (padElement = e), ELEMENT_COLORS[e]),
  );

  const wrap = document.createElement('div');
  wrap.className = 'mx-auto flex max-w-xl flex-col gap-3 p-4 pb-20';
  const title = document.createElement('h1');
  title.className = 'text-center text-2xl font-bold text-amber-300';
  title.textContent = 'Ses laboratuvarı';
  const note = document.createElement('p');
  note.className = 'text-center text-xs text-slate-400';
  note.textContent = 'Tarayıcı sesi ilk dokunuştan sonra açar. Hiç ses gelmezse sağ alttaki 🔊 düğmesine ve cihazının sesine bak.';
  wrap.append(title, note, controls);

  for (const e of ELEMENTS) {
    wrap.append(
      section(
        ELEMENT_NAMES[e],
        btn('Büyü yükleniyor', play('charge', { element: e }), ELEMENT_COLORS[e]),
        btn('Fırlatma', play('launch', { element: e }), ELEMENT_COLORS[e]),
        btn('Vuruş', () => engine.play('impact', { element: e, intensity }), ELEMENT_COLORS[e]),
      ),
    );
  }
  wrap.append(
    section('Kalkan', btn('Kalkan kurulur', play('shieldUp')), btn('Tam savunma', () => engine.play('shieldBlock', { intensity: 1 })), btn('Kısmi savunma', () => engine.play('shieldBlock', { intensity: 0.4 })), btn('Kalkan parçalanır', play('shieldBreak'))),
    section('Vuruş sonrası', btn('Başa vuruş (ting)', play('crit')), btn('Büyü yapamadı', play('fizzle')), btn('Yenilgi', play('defeat'))),
    section('Element açılışı', btn('Saldırı üstün', play('revealAdvantage')), btn('Savunma üstün', play('revealDisadvantage')), btn('Etkisiz', play('revealNeutral'))),
    section('Arayüz', btn('Seçim', play('pick')), btn('Sıra', play('turn')), btn('Zafer', play('victory')), btn('Bozgun', play('lose'))),
    section('Çizim sesi (element)', ...padChips),
    pad,
  );
  page.appendChild(wrap);
}
