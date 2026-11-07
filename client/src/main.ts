import './style.css';
import { InputManager } from './input/inputManager';
import { watchTouchDevice } from './input/device';
import { KeyboardSource } from './input/keyboard';
import { DPad } from './ui/dpad';
import { lockTouchScroll } from './ui/touchLock';

// Task 1 duman testi + Task 3 girdi katmanı. Gerçek dünya (Task 4) ve arena (Task 12) bunları değiştirecek.
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="mx-auto flex h-full max-w-3xl flex-col items-center gap-3 p-4 text-center">
    <h1 class="text-3xl font-bold">MagicalBattle</h1>
    <p class="text-slate-400">Altyapı testi: iki motor ve girdi katmanı</p>
    <p class="text-sm text-slate-300">Girdi: <span id="axis">x=0.00 y=0.00</span> · <span id="mode">klavye</span></p>
    <section class="grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-2 gap-3 sm:grid-cols-2 sm:grid-rows-1">
      <div class="flex min-h-0 min-w-0 flex-col"><h2 class="mb-1 text-sm">2D Dünya (Phaser)</h2><div id="world" class="min-h-0 w-full flex-1 overflow-hidden rounded bg-black"></div></div>
      <div class="flex min-h-0 min-w-0 flex-col"><h2 class="mb-1 text-sm">3D Arena (Three.js)</h2><div id="battle" class="min-h-0 w-full flex-1 overflow-hidden rounded bg-black"></div></div>
    </section>
  </main>
`;

lockTouchScroll();

const dpad = new DPad();
document.body.appendChild(dpad.element);
const input = new InputManager([new KeyboardSource(), dpad]);

const modeEl = document.querySelector<HTMLSpanElement>('#mode')!;
watchTouchDevice((isTouch) => {
  dpad.setVisible(isTouch);
  modeEl.textContent = isTouch ? 'dokunmatik (D-Pad)' : 'klavye (WASD / oklar)';
});

const axisEl = document.querySelector<HTMLSpanElement>('#axis')!;
const tick = (): void => {
  const a = input.getAxis();
  axisEl.textContent = `x=${a.x.toFixed(2)} y=${a.y.toFixed(2)}`;
  requestAnimationFrame(tick);
};
tick();

void import('./world/bootWorld').then((m) => m.bootWorld(document.querySelector('#world')!));
void import('./battle/bootBattle').then((m) => m.bootBattle(document.querySelector('#battle')!));
