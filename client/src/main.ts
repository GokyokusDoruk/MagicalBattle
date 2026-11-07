import './style.css';
import { watchTouchDevice } from './input/device';
import { InputManager } from './input/inputManager';
import { KeyboardSource } from './input/keyboard';
import { DPad } from './ui/dpad';
import { Minimap } from './ui/minimap';
import { Toast } from './ui/toast';
import { lockTouchScroll } from './ui/touchLock';
import { TILE_SIZE } from './world/tiles';
import { GateRegistry } from './world/gates';
import { generateMap } from './world/generateMap';
import { QuestTracker } from './world/questMarkers';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = '<div id="world" class="fixed inset-0"></div>';

lockTouchScroll();

const dpad = new DPad();
const toast = new Toast();
document.body.append(dpad.element, toast.element);
const input = new InputManager([new KeyboardSource(), dpad]);
watchTouchDevice((isTouch) => dpad.setVisible(isTouch));

const map = generateMap();
const gates = new GateRegistry();
const quests = new QuestTracker();
const minimap = new Minimap(map, gates, quests);
document.body.appendChild(minimap.element);

// Geliştirme sunucusunda konsoldan kapı/görev denemek için (üretim derlemesine girmez).
let pendingTeleport: { x: number; y: number } | null = null;
const debug = {
  gates,
  quests,
  player: { x: 0, y: 0 },
  /** Oyuncuyu karo koordinatına ışınlar */
  teleportToTile: (tx: number, ty: number) => {
    pendingTeleport = { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
  },
};
if (import.meta.env.DEV) Object.assign(window, { __mb: debug });

void import('./world/bootWorld').then((m) =>
  m.bootWorld(document.querySelector('#world')!, {
    map,
    getAxis: () => input.getAxis(),
    gates,
    quests,
    notify: (message) => toast.show(message),
    takeTeleport: () => {
      const t = pendingTeleport;
      pendingTeleport = null;
      return t;
    },
    onFrame: (player) => {
      debug.player = player;
      minimap.update(player);
    },
  }),
);
