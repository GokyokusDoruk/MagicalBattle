import { LOGICAL_SIZE } from '../battle/gesture/config';
import { clampPose, type TargetPose } from '../battle/damage/target';
import { paintSilhouette } from './drawingCanvas';

/** Yer seçimi için tanınan süre; dolunca o anki yer kabul edilir */
export const POSITION_PICK_MS = 7000;

/**
 * Faz 3: savunan, saldırıdan önce kendi yerini ve yönünü seçer. Tuvalde kendi silüetin durur; parmağınla/fareyle sürükleyerek
 * yerini değiştirir, "Döndür" ile başını yukarı/sağa/aşağı/sola çevirirsin. Silüetin boyu sabittir, yalnızca yeri değişir ve tuvalin dışına çıkamaz. "Tamam" ya da süre dolunca seçilen yer döner.
 * `host` içine çizilir; bitince temizlenir.
 */
export function pickPosition(host: HTMLElement, start: TargetPose, limitMs = POSITION_PICK_MS): Promise<TargetPose> {
  host.innerHTML = `<div class="flex h-full flex-col items-center justify-center gap-3 bg-slate-950/85 p-3">
      <h2 class="text-lg font-bold text-sky-200">Yerini seç</h2>
      <p class="text-center text-xs text-slate-300">Silüetini sürükle, Döndür ile başını istediğin yana çevir. Rakip yalnızca bulanık bir gölge görür: başının nerede olduğunu bilmez.</p>
      <canvas class="touch-none rounded-lg border-2 border-sky-200/50 bg-slate-950" style="width:min(88vw,60vh);aspect-ratio:1;touch-action:none;cursor:grab"></canvas>
      <div class="w-[min(88vw,60vh)]">
        <div class="h-2 overflow-hidden rounded bg-white/10"><div data-fill class="h-full w-full bg-sky-300"></div></div>
        <div class="mt-2 flex justify-between gap-2">
          <button data-turn type="button" class="rounded bg-white/10 px-4 py-1.5 text-sky-100 hover:bg-white/20">↻ Döndür</button>
          <button data-ok type="button" class="rounded bg-sky-300 px-4 py-1.5 font-bold text-slate-900">Tamam</button>
        </div>
      </div></div>`;
  const canvas = host.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const fill = host.querySelector<HTMLElement>('[data-fill]')!;
  let pose = clampPose(start);
  let drag: { id: number; x: number; y: number; cx: number; cy: number } | null = null;

  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const toLogical = (e: PointerEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * LOGICAL_SIZE, y: ((e.clientY - r.top) / r.height) * LOGICAL_SIZE };
  };
  const render = (): void => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintSilhouette(ctx, pose, canvas.width / LOGICAL_SIZE, 'self');
  };

  return new Promise((resolve) => {
    const began = performance.now();
    const timer = window.setInterval(() => {
      const left = Math.max(0, 1 - (performance.now() - began) / limitMs);
      fill.style.width = `${left * 100}%`;
      if (left <= 0) done();
    }, 50);
    const done = (): void => {
      window.clearInterval(timer);
      host.innerHTML = '';
      resolve(pose);
    };
    // Silüetin herhangi bir yerinden (ya da tuvalin her yerinden) tutup sürüklenir: göreli hareket
    canvas.addEventListener('pointerdown', (e) => {
      if (drag) return;
      e.preventDefault();
      const p = toLogical(e);
      drag = { id: e.pointerId, x: p.x, y: p.y, cx: pose.cx, cy: pose.cy };
      canvas.style.cursor = 'grabbing';
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // yakalama reddedilirse sürükleme yine çalışır
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = toLogical(e);
      pose = clampPose({ cx: drag.cx + (p.x - drag.x), cy: drag.cy + (p.y - drag.y), turn: pose.turn });
      render();
    });
    const release = (e: PointerEvent): void => {
      if (drag && e.pointerId === drag.id) drag = null;
      canvas.style.cursor = 'grab';
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    host.querySelector('[data-ok]')!.addEventListener('click', done);
    // Çeyrek tur döndürür (baş yukarı → sağ → aşağı → sol); sınırlar yöne göre yeniden uygulanır
    host.querySelector('[data-turn]')!.addEventListener('click', () => {
      pose = clampPose({ cx: pose.cx, cy: pose.cy, turn: (pose.turn ?? 0) + 1 });
      render();
    });
    render();
  });
}
