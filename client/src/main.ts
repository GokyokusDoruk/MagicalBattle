import './style.css';
import { ApiClient, resolveApiUrl, type ApiUser } from './api/client';
import { Narrator } from './audio/narrator';
import { CHAPTER_SCENES } from './data/story/scenes';
import { watchTouchDevice } from './input/device';
import { InputManager } from './input/inputManager';
import { KeyboardSource } from './input/keyboard';
import { savePointForCity, type SaveData } from './save/saveData';
import { SaveManager } from './save/saveManager';
import { Progress } from './story/progress';
import { showAuthScreen } from './ui/authScreen';
import { DPad } from './ui/dpad';
import { Minimap } from './ui/minimap';
import { askPlayerName } from './ui/nameScreen';
import { StoryPlayer } from './ui/storyScene';
import { Toast } from './ui/toast';
import { lockTouchScroll } from './ui/touchLock';
import { createUserBadge } from './ui/userBadge';
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

// --- Hesap ve kayıt -------------------------------------------------------------------------
const api = new ApiClient(resolveApiUrl(location.hostname, import.meta.env.VITE_API_URL));

/** Açık oturum varsa onu kullanır, yoksa giriş ekranını gösterir. null = kayıtsız oyna. */
async function authenticate(): Promise<ApiUser | null> {
  try {
    const existing = await api.me();
    if (existing) return existing;
  } catch {
    // Sunucuya ulaşılamadı: giriş ekranı kendi hata mesajını gösterir, "Kayıtsız oyna" açık kalır
  }
  return showAuthScreen(api);
}

const user = await authenticate();

let save: SaveData | null = null;
let savingEnabled = user !== null;
let loadFailed = false;
if (user) {
  try {
    save = await api.getSave();
  } catch {
    // Kayıt yüklenemediyse üzerine yazmamak için bu oturumda kaydetme kapatılır
    savingEnabled = false;
    loadFailed = true;
  }
}

const playerName = save?.playerName ?? (await askPlayerName(user?.firstName ?? ''));
if (save) progress.restore({ completedChapters: save.completedChapters });

const saves = new SaveManager(savingEnabled ? api : null, progress, playerName);
// Yeni oyunda ad hemen kaydedilir; kayıt noktasına varmadan çıkılsa bile ad kaybolmaz
if (!save && savingEnabled) void saves.saveAt(null);

document.body.appendChild(
  createUserBadge(
    `${playerName}${user ? (user.isGuest ? ' (misafir)' : '') : ' (kayıtsız)'}`,
    user ? () => void api.logout().finally(() => location.reload()) : null,
  ),
);
if (loadFailed) toast.show('Kayıt yüklenemedi. Bu oturumda ilerleme kaydedilmeyecek.');
else toast.show(`Hoş geldin, ${playerName}!`);

// --- Oyun -----------------------------------------------------------------------------------
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
  api,
  saves,
  player: { x: 0, y: 0 },
  /** Oyuncuyu karo koordinatına ışınlar */
  teleportToTile: (tx: number, ty: number) => {
    pendingTeleport = { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
  },
};
// Geliştirme sunucusunda konsoldan denemek için (üretim derlemesine girmez).
if (import.meta.env.DEV) Object.assign(window, { __mb: debug });

const STILL = { x: 0, y: 0 };
const startPoint = save?.savePoint ? { x: save.savePoint.tileX, y: save.savePoint.tileY } : undefined;

void import('./world/bootWorld').then((m) =>
  m.bootWorld(document.querySelector('#world')!, {
    map,
    startTile: startPoint,
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
    // Şehre girmek kayıt noktasıdır: ilerleme sunucuya yazılır
    onCityEnter: (cityId) => {
      const city = LOCATIONS.find((l) => l.id === cityId);
      if (!city) return;
      void saves.saveAt(savePointForCity(city)).then((result) => {
        if (result === 'saved') toast.show(`Kayıt noktası: ${city.name}. İlerleme kaydedildi.`);
        else if (result === 'failed') toast.show('Kayıt başarısız oldu. Sonraki kayıt noktasında tekrar denenecek.');
        else toast.show(`Kayıt noktası: ${city.name} (bu oturumda ilerleme kaydedilmiyor)`);
      });
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
