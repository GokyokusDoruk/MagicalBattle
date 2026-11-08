import { getSoundEngine } from '../audio/sfx/engine';
import { createArenaSounds } from '../audio/sfx/arenaSounds';
import { ArenaView, type CombatantSpec } from '../battle/arena/arenaView';
import { ELEMENT_COLORS } from '../battle/arena/palette';
import type { SlotRef } from '../battle/arena/layout';
import { calculateDamage } from '../battle/damage/calculate';
import { ELEMENT_NAMES, ELEMENTS, type Element } from '../battle/damage/elements';
import { buildDensity } from '../battle/gesture/density';
import { computeMetrics, validateSpell } from '../battle/gesture/metrics';
import type { Stroke } from '../battle/gesture/types';
import { DrawingCanvas } from './drawingCanvas';
import { createSoundToggle } from './soundToggle';
import { lockTouchScroll } from './touchLock';

// --- Demo çizimleri (mantıksal 256x256 tuvalde) ---------------------------------------------

const withTime = (pts: [number, number][], ms: number): Stroke => pts.map(([x, y], i) => ({ x, y, t: (i / (pts.length - 1)) * ms }));

const DEMOS: Record<string, { name: string; strokes: () => Stroke[] }> = {
  circle: {
    name: 'Daire',
    strokes: () =>
      [withTime(Array.from({ length: 49 }, (_, i) => [128 + 78 * Math.cos((i / 48) * Math.PI * 2), 128 + 78 * Math.sin((i / 48) * Math.PI * 2)] as [number, number]), 2600)],
  },
  star: {
    name: 'Yıldız',
    strokes: () => {
      const pts: [number, number][] = [0, 2, 4, 1, 3, 0].map((k) => {
        const a = -Math.PI / 2 + (k / 5) * Math.PI * 2;
        return [128 + 92 * Math.cos(a), 132 + 92 * Math.sin(a)] as [number, number];
      });
      // Köşeler arası düz çizgiler için ara noktalar ekle
      const dense: [number, number][] = [];
      for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < 12; s++) dense.push([pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * s) / 12, pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * s) / 12]);
      dense.push(pts[pts.length - 1]);
      return [withTime(dense, 2800)];
    },
  },
  spiral: {
    name: 'Spiral',
    strokes: () =>
      [withTime(Array.from({ length: 90 }, (_, i) => {
        const a = (i / 89) * Math.PI * 5;
        const r = 12 + (i / 89) * 82;
        return [128 + r * Math.cos(a), 128 + r * Math.sin(a)] as [number, number];
      }), 2800)],
  },
  wave: {
    name: 'Dalga',
    strokes: () => [withTime(Array.from({ length: 60 }, (_, i) => [22 + (i / 59) * 212, 128 + 60 * Math.sin((i / 59) * Math.PI * 3)] as [number, number]), 2400)],
  },
};

const analyze = (strokes: Stroke[]) => {
  const density = buildDensity(strokes);
  const metrics = computeMetrics(strokes, density);
  return { density, metrics, validity: validateSpell(metrics) };
};

const P: SlotRef = { team: 0, index: 0 };
const O: SlotRef = { team: 1, index: 0 };

/**
 * Arena laboratuvarı (`?lab=arena`): 3D arenayı, büyü görsellerini ve vuruş efektlerini dene.
 * "Çiz ve savaş" ile kendi çizdiğin büyüyü, hasar hesabıyla birlikte arenada oynatabilirsin.
 */
export function startArenaLab(root: HTMLElement): void {
  lockTouchScroll();
  root.innerHTML = '';
  const stage = document.createElement('div');
  stage.className = 'fixed inset-0 bg-black';
  root.appendChild(stage);

  let arena: ArenaView;
  try {
    arena = new ArenaView(stage, createArenaSounds(getSoundEngine()));
    root.appendChild(createSoundToggle(getSoundEngine()));
  } catch {
    stage.innerHTML = '<p class="p-6 text-center text-amber-200">Bu cihazda 3D (WebGL) desteklenmiyor.</p>';
    return;
  }

  let teamSize = 1;
  let playerElement: Element = 'fire';
  let opponentElement: Element = 'water';
  let demo = 'circle';
  let busy = false;

  const specs = (): [CombatantSpec[], CombatantSpec[]] => {
    const team = (names: string[], el: Element): CombatantSpec[] => names.slice(0, teamSize).map((name) => ({ name, element: el }));
    return [team(['Sen', 'Elysia'], playerElement), team(['Rakip', 'Gölge'], opponentElement)];
  };
  const rebuild = (): void => arena.setTeams(specs());
  rebuild();

  // --- Arayüz ----------------------------------------------------------------------------
  const ui = document.createElement('div');
  ui.className = 'pointer-events-none fixed inset-x-0 top-0 z-10 flex flex-col gap-2 p-2 text-sm text-amber-50';
  root.appendChild(ui);
  const bottom = document.createElement('div');
  bottom.className = 'pointer-events-none fixed inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 p-2';
  root.appendChild(bottom);

  const status = document.createElement('div');
  status.className = 'pointer-events-auto rounded bg-black/60 px-3 py-1 text-center';
  status.textContent = 'Arena laboratuvarı: bir demo büyü dene ya da kendi büyünü çiz.';

  const chip = (label: string, active: boolean, color: string | null, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = `pointer-events-auto rounded px-2 py-1 text-xs font-bold ${active ? 'ring-2 ring-white' : 'opacity-75'} ${color ? 'text-slate-900' : 'bg-slate-700 text-amber-50'}`;
    if (color) b.style.background = color;
    b.addEventListener('click', onClick);
    return b;
  };

  const renderUi = (): void => {
    ui.innerHTML = '';
    const row = (label: string, ...children: HTMLElement[]): HTMLElement => {
      const r = document.createElement('div');
      r.className = 'flex flex-wrap items-center gap-1 rounded bg-black/55 px-2 py-1';
      const l = document.createElement('span');
      l.textContent = label;
      l.className = 'pointer-events-none mr-1 text-xs text-slate-300';
      r.append(l, ...children);
      return r;
    };
    ui.append(
      row('Mod', chip('1v1', teamSize === 1, null, () => ((teamSize = 1), rebuild(), renderUi())), chip('2v2', teamSize === 2, null, () => ((teamSize = 2), rebuild(), renderUi()))),
      row('Sen', ...ELEMENTS.map((e) => chip(ELEMENT_NAMES[e], playerElement === e, `#${ELEMENT_COLORS[e].main.toString(16).padStart(6, '0')}`, () => ((playerElement = e), rebuild(), renderUi())))),
      row('Rakip', ...ELEMENTS.map((e) => chip(ELEMENT_NAMES[e], opponentElement === e, `#${ELEMENT_COLORS[e].main.toString(16).padStart(6, '0')}`, () => ((opponentElement = e), rebuild(), renderUi())))),
      row('Demo çizim', ...Object.entries(DEMOS).map(([id, d]) => chip(d.name, demo === id, null, () => ((demo = id), renderUi())))),
    );
  };
  renderUi();

  const button = (label: string, primary: boolean, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = `pointer-events-auto rounded px-3 py-2 text-sm font-bold disabled:opacity-40 ${primary ? 'bg-amber-300 text-slate-900' : 'bg-slate-700 text-amber-50'}`;
    b.addEventListener('click', onClick);
    return b;
  };

  const buttons: HTMLButtonElement[] = [];
  const run = async (label: string, fn: () => Promise<void>): Promise<void> => {
    if (busy) return;
    busy = true;
    buttons.forEach((b) => (b.disabled = true));
    status.textContent = label;
    try {
      await fn();
    } finally {
      busy = false;
      buttons.forEach((b) => (b.disabled = false));
    }
  };

  /** Bir tur: (varsa) savunma kalkanı kurulur, saldırı fırlar, vuruş efektleri oynar. Gerçek hasar hesabıyla. */
  const playRound = async (attackStrokes: Stroke[], defenseStrokes: Stroke[] | null, attacker: SlotRef, defender: SlotRef, aEl: Element, dEl: Element): Promise<void> => {
    const attack = analyze(attackStrokes);
    const defense = defenseStrokes ? analyze(defenseStrokes) : null;
    const defended = defense?.validity.valid === true;
    const dmg = calculateDamage({ basePower: 100, attack, defense: defended ? defense!.density : null, attackerElement: aEl, defenderElement: dEl });

    if (defended) await arena.showShield(defender, attacker, defenseStrokes!);
    await arena.castSpell(attacker, defender, attackStrokes, aEl);
    await arena.impact(defender, attacker, { damage: dmg.finalDamage, blockedRatio: dmg.defendedRatio, head: dmg.headShare > 0.5, element: aEl });
    status.textContent = `Hasar: ${dmg.finalDamage} · savunulan %${(dmg.defendedRatio * 100).toFixed(0)} · baş payı %${(dmg.headShare * 100).toFixed(0)}`;
  };

  const demoStrokes = (): Stroke[] => DEMOS[demo].strokes();
  // Savunma demosu: saldırının yaklaşık yarısını kaplayan bir yay
  const halfDefense = (): Stroke[] => [withTime(Array.from({ length: 30 }, (_, i) => [128 + 78 * Math.cos((i / 29) * Math.PI), 128 + 78 * Math.sin((i / 29) * Math.PI)] as [number, number]), 1500)];

  /** Kendi çizimin: önce saldırı, sonra savunma çiz (savunan saldırıyı soluk görür), sonra arenada oynar. */
  const drawAndFight = async (): Promise<void> => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-4';
    root.appendChild(modal);
    const title = document.createElement('h2');
    title.className = 'text-lg font-bold text-amber-200';
    modal.appendChild(title);

    title.textContent = '1. Saldırı: büyünü çiz';
    const atkCanvas = new DrawingCanvas({ color: `#${ELEMENT_COLORS[playerElement].main.toString(16).padStart(6, '0')}`, showHeadZone: true, drawSound: () => getSoundEngine().beginDraw(playerElement) });
    modal.appendChild(atkCanvas.element);
    const atk = await atkCanvas.start();
    modal.remove();
    if (!atk.validity.valid) {
      status.textContent = `Büyü yapamadı! ${atk.validity.message}`;
      return;
    }

    const modal2 = document.createElement('div');
    modal2.className = modal.className;
    root.appendChild(modal2);
    const title2 = document.createElement('h2');
    title2.className = 'text-lg font-bold text-emerald-200';
    title2.textContent = '2. Savunma: rakibin saldırısını durdur';
    modal2.appendChild(title2);
    const defCanvas = new DrawingCanvas({ color: '#7df0c4', ghost: atk.strokes, showHeadZone: true, drawSound: () => getSoundEngine().beginDraw(opponentElement) });
    modal2.appendChild(defCanvas.element);
    const def = await defCanvas.start();
    modal2.remove();

    await run('Büyü oynatılıyor...', () => playRound(atk.strokes as Stroke[], def.validity.valid ? (def.strokes as Stroke[]) : null, P, O, playerElement, opponentElement));
  };

  const rowEl = (...items: HTMLElement[]): HTMLElement => {
    const r = document.createElement('div');
    r.className = 'flex flex-wrap justify-center gap-2';
    r.append(...items);
    return r;
  };
  const make = (label: string, primary: boolean, fn: () => void): HTMLButtonElement => {
    const b = button(label, primary, fn);
    buttons.push(b);
    return b;
  };

  bottom.append(
    status,
    rowEl(
      make('Çiz ve savaş', true, () => void drawAndFight()),
      make('Saldırı (demo)', false, () => void run('Saldırı...', async () => {
        await arena.castSpell(P, O, demoStrokes(), playerElement);
        await arena.impact(O, P, { damage: 45, blockedRatio: 0, head: false, element: playerElement });
      })),
      make('Rakip saldırır', false, () => void run('Rakip saldırıyor...', async () => {
        await arena.castSpell(O, P, demoStrokes(), opponentElement);
        await arena.impact(P, O, { damage: 38, blockedRatio: 0, head: false, element: opponentElement });
      })),
    ),
    rowEl(
      make('Başa vuruş', false, () => void run('Başa vuruş...', async () => {
        await arena.castSpell(P, O, demoStrokes(), playerElement);
        await arena.impact(O, P, { damage: 72, blockedRatio: 0, head: true, element: playerElement });
      })),
      make('Yarım savunma', false, () => void run('Yarım savunma...', () => playRound(demoStrokes(), halfDefense(), P, O, playerElement, opponentElement))),
      make('Tam savunma', false, () => void run('Tam savunma...', () => playRound(demoStrokes(), demoStrokes(), P, O, playerElement, opponentElement))),
      make('Yenil', false, () => {
        arena.defeat(O);
        status.textContent = 'Rakip yenildi.';
      }),
      make('Sıfırla', false, () => {
        arena.resetCombatants();
        status.textContent = 'Sıfırlandı.';
      }),
    ),
  );
}
