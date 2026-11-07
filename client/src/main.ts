import './style.css';
import { Narrator } from './audio/narrator';
import { CHAPTER_SCENES } from './data/story/scenes';
import { watchTouchDevice } from './input/device';
import { InputManager } from './input/inputManager';
import { KeyboardSource } from './input/keyboard';
import { Progress } from './story/progress';
import { DPad } from './ui/dpad';
import { Minimap } from './ui/minimap';
import { StoryPlayer } from './ui/storyScene';
import { Toast } from './ui/toast';
import { lockTouchScroll } from './ui/touchLock';
import { GateRegistry } from './world/gates';
import { generateMap } from './world/generateMap';
import { LOCATIONS } from './world/locations';
import { QuestTracker } from './world/questMarkers';
import { TILE_SIZE } from './world/tiles';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = '<div id="world" class="fixed inset-0"></div>';

lockTouchScroll();

const narrator = new Narrator();
const story = new StoryPlayer(narrator);
const dpad = new DPad();
const toast = new Toast();
document.body.append(dpad.element, toast.element, story.element);
const input = new InputManager([new KeyboardSource(), dpad]);
watchTouchDevice((isTouch) => dpad.setVisible(isTouch));

const map = generateMap();
const gates = new GateRegistry();
const quests = new QuestTracker();
const progress = new Progress(gates, quests);
const minimap = new Minimap(map, gates, quests);
document.body.appendChild(minimap.element);

gates.onChange((cityId, unlocked) => {
  const city = LOCATIONS.find((l) => l.id === cityId);
  if (unlocked && city) toast.show(`${city.name} kapısı açıldı!`);
});

let pendingTeleport: { x: number; y: number } | null = null;
const debug = {
  gates,
  quests,
  progress,
  story,
  player: { x: 0, y: 0 },
  /** Oyuncuyu karo koordinatına ışınlar */
  teleportToTile: (tx: number, ty: number) => {
    pendingTeleport = { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
  },
};
// Geliştirme sunucusunda konsoldan denemek için (üretim derlemesine girmez).
if (import.meta.env.DEV) Object.assign(window, { __mb: debug });

const STILL = { x: 0, y: 0 };

void import('./world/bootWorld').then((m) =>
  m.bootWorld(document.querySelector('#world')!, {
    map,
    // Sahne açıkken karakter durur
    getAxis: () => (story.isOpen ? STILL : input.getAxis()),
    gates,
    quests,
    notify: (message) => toast.show(message),
    onMarkerEnter: (marker) => {
      const scene = CHAPTER_SCENES[marker.chapter];
      if (story.isOpen || !scene) return;
      // Sahne bitince (atlansa da) bölüm tamamlanır: kapı açılır, sonraki görev belirir.
      // Boss savaşları gelince (Task 19) tamamlanma savaşın sonucuna bağlanacak.
      void story.play(scene).then(() => progress.completeChapter(marker.chapter));
    },
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
