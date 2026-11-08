import { ApiClient, resolveApiUrl, type ApiUser } from './api/client';
import { Narrator } from './audio/narrator';
import { getSoundEngine } from './audio/sfx/engine';
import { CHAPTER_SCENES } from './data/story/scenes';
import { getItem } from './economy/items';
import { PlayerState } from './economy/player';
import { watchTouchDevice } from './input/device';
import { InputManager } from './input/inputManager';
import { KeyboardSource } from './input/keyboard';
import { QuestEngine, type QuestCompletion } from './quests/engine';
import { normalizeSave, savePointForCity, type SaveData } from './save/saveData';
import { SaveManager } from './save/saveManager';
import { WandInventory } from './wands/inventory';
import { chapterChoiceTrees, linesTree } from './dialogue/moralDialogues';
import { finalLines } from './morality/final';
import { Morality } from './morality/morality';
import { DialogueUi } from './ui/dialogueUi';
import { WandUi } from './ui/wandUi';
import { SkillTree } from './skills/tree';
import { Progress } from './story/progress';
import { showAuthScreen } from './ui/authScreen';
import { DPad } from './ui/dpad';
import { MerchantUi } from './ui/merchantUi';
import { Minimap } from './ui/minimap';
import { askPlayerName } from './ui/nameScreen';
import { SkillTreeUi } from './ui/skillTreeUi';
import { StatusBar } from './ui/statusBar';
import { StoryPlayer } from './ui/storyScene';
import { Toast } from './ui/toast';
import { lockTouchScroll } from './ui/touchLock';
import { createUserBadge } from './ui/userBadge';
import { GateRegistry } from './world/gates';
import { generateMap } from './world/generateMap';
import { LOCATIONS } from './world/locations';
import { merchantSpots } from './world/merchantSpots';
import { PICKUP_SPOTS } from './world/pickups';
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
    const raw = await api.getSave();
    save = raw ? normalizeSave(raw) : null;
  } catch {
    // Kayıt yüklenemediyse üzerine yazmamak için bu oturumda kaydetme kapatılır
    savingEnabled = false;
    loadFailed = true;
  }
}

const playerName = save?.playerName ?? (await askPlayerName(user?.firstName ?? ''));
if (save) progress.restore({ completedChapters: save.completedChapters });

// Ekonomi (altın, XP, çanta), yan görevler ve toplanan eşyalar. Yükleme sırası: önce oyuncu, sonra görevler.
const hero = new PlayerState();
const sideQuests = new QuestEngine(hero);
const skillTree = new SkillTree(() => hero.level);
const wands = new WandInventory();
const morality = new Morality();
// Ahlak etkisi: Düzen Bekçisi görev altınını artırır (tüccar fiyatları merchantUi'a bağlı, aşağıda)
const applyMoralEffects = (): void => {
  sideQuests.goldMultiplier = morality.effects.questGoldMultiplier;
};
const collected = new Set<string>(save?.collected ?? []);
if (save) {
  hero.restore(save);
  sideQuests.restore(save.quests);
  skillTree.restore(save.skills); // seviye (puan) yüklendikten sonra
  wands.restore(save);
  morality.restore(save.choices);
}
applyMoralEffects();

const saves = new SaveManager(savingEnabled ? api : null, progress, playerName, () => ({
  economy: hero.snapshot(),
  quests: sideQuests.snapshot(),
  collected: [...collected],
  skills: skillTree.snapshot(),
  wands: wands.snapshot(),
  choices: morality.snapshot(),
}));
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

const sfx = getSoundEngine();
const skillUi = new SkillTreeUi({
  tree: skillTree,
  level: () => hero.level,
  gold: { balance: () => hero.gold, spend: (n) => hero.spendGold(n) },
  onChanged: () => setDirty(true),
});
document.body.appendChild(skillUi.element);
const wandUi = new WandUi({ wands, onChanged: () => setDirty(true) });
document.body.appendChild(wandUi.element);
const statusBar = new StatusBar(
  () => {
    if (!story.isOpen && !merchantUi.isOpen && !wandUi.isOpen && !dialogueUi.isOpen) skillUi.toggle();
  },
  () => {
    if (!story.isOpen && !merchantUi.isOpen && !skillUi.isOpen && !dialogueUi.isOpen) wandUi.toggle();
  },
);
document.body.appendChild(statusBar.element);

/** Son kayıt noktasından sonra değişen bir şey var mı (kayıt yalnızca şehirlerde yapılır). */
let dirty = false;
const refreshHud = (): void =>
  statusBar.update({
    level: hero.level,
    gold: hero.gold,
    xp: hero.xp,
    dirty: dirty && saves.enabled,
    quests: sideQuests.active().map((q) => ({ title: q.title, ...sideQuests.progress(q.id) })),
    skillPoints: skillTree.pointsFree,
    moralityLabel: `${morality.effects.label} (${morality.score > 0 ? '+' : ''}${morality.score})`,
    wandsReady: wands.owned().some((w) => wands.checkSynthesis(w.id).ok),
  });
const setDirty = (value: boolean): void => {
  dirty = value;
  refreshHud();
};
hero.onChange(refreshHud);
sideQuests.onChange(refreshHud);
skillTree.onChange(refreshHud);
wands.onChange(refreshHud);
morality.onChange(() => {
  applyMoralEffects();
  refreshHud();
});
refreshHud();

/** Biten yan görevleri bildirir (ödüller zaten envantere yattı). */
const handleCompletions = (list: QuestCompletion[]): void => {
  for (const c of list) {
    const parts = [`+${c.gold} altın`, `+${c.xp} XP`, ...c.items.map((i) => `+${i.count} ${getItem(i.id)?.name ?? i.id}`)];
    toast.show(`Görev tamamlandı: ${c.quest.title} (${parts.join(', ')})`);
    sfx.play('revealAdvantage');
    if (c.levelsGained > 0) {
      window.setTimeout(() => {
        toast.show(`Seviye atladın! Seviye ${hero.level}. Yetenek puanın: ${skillTree.pointsFree} (K)`);
        sfx.play('victory');
      }, 2800);
    }
  }
  if (list.length > 0) setDirty(true);
};

const merchantUi = new MerchantUi({
  player: hero,
  quests: sideQuests,
  wands,
  sfx,
  priceMultipliers: () => ({ buy: morality.effects.buyMultiplier, sell: morality.effects.sellMultiplier }),
  onChanged: () => setDirty(true),
  onQuestCompletion: (c) => handleCompletions([c]),
});
document.body.appendChild(merchantUi.element);
const dialogueUi = new DialogueUi(narrator);
document.body.appendChild(dialogueUi.element);
const modalOpen = (): boolean => story.isOpen || merchantUi.isOpen || skillUi.isOpen || wandUi.isOpen || dialogueUi.isOpen;

/** Bir bölümün ahlak seçimlerini (bölümde 2) sırayla oynatır; bölüm 8'de ardından final sahnesi gelir. */
async function playChapterChoices(chapter: number): Promise<void> {
  const ctx = {
    score: () => morality.score,
    flags: new Set<string>(),
    onEffect: (e: import('./dialogue/engine').DialogueEffect): void => {
      if (e.type !== 'moral' || !morality.choose(e.choiceId, e.side)) return;
      setDirty(true);
      const sign = morality.score > 0 ? '+' : '';
      toast.show(`Ahlak puanın: ${sign}${morality.score} (${morality.effects.label})`);
    },
  };
  for (const tree of chapterChoiceTrees(chapter)) {
    if (morality.decided(tree.id)) continue; // daha önce yapılmış seçim tekrarlanmaz
    await dialogueUi.run(tree, ctx);
  }
  if (chapter === 8) await dialogueUi.run(linesTree('final', finalLines(morality.score)), ctx);
}
// K: yetenek ağacı, W: asalar (sahne ya da tüccar açıkken açılmaz)
window.addEventListener('keydown', (e) => {
  if (e.repeat || story.isOpen || merchantUi.isOpen || dialogueUi.isOpen) return;
  if (e.code === 'KeyK' && !wandUi.isOpen) skillUi.toggle();
  if (e.code === 'KeyW' && !skillUi.isOpen) wandUi.toggle();
});

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
  hero,
  sideQuests,
  merchantUi,
  skillTree,
  skillUi,
  wands,
  wandUi,
  morality,
  dialogueUi,
  playChapterChoices,
  collected,
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
    // Sahne ya da tüccar ekranı açıkken karakter durur
    getAxis: () => (modalOpen() ? STILL : input.getAxis()),
    gates,
    quests,
    notify: (message) => toast.show(message),
    onMarkerEnter: (marker) => {
      const scene = CHAPTER_SCENES[marker.chapter];
      if (modalOpen() || !scene) return;
      // Sahne bitince (atlansa da) bölümün ahlak seçimleri oynanır, sonra bölüm tamamlanır: kapı açılır, sonraki görev belirir.
      // Boss savaşları gelince (Task 19) tamamlanma savaşın sonucuna bağlanacak.
      void story
        .play(scene)
        .then(() => playChapterChoices(marker.chapter))
        .then(() => progress.completeChapter(marker.chapter));
    },
    // Şehre girmek kayıt noktasıdır: ilerleme sunucuya yazılır
    onCityEnter: (cityId) => {
      const city = LOCATIONS.find((l) => l.id === cityId);
      if (!city) return;
      void saves.saveAt(savePointForCity(city)).then((result) => {
        if (result === 'saved') {
          setDirty(false);
          toast.show(`Kayıt noktası: ${city.name}. İlerleme kaydedildi.`);
        }
        else if (result === 'failed') toast.show('Kayıt başarısız oldu. Sonraki kayıt noktasında tekrar denenecek.');
        else toast.show(`Kayıt noktası: ${city.name} (bu oturumda ilerleme kaydedilmiyor)`);
      });
    },
    merchants: merchantSpots(map),
    onMerchantEnter: (id) => {
      if (!modalOpen()) merchantUi.open(id);
    },
    pickups: PICKUP_SPOTS,
    isCollected: (id) => collected.has(id),
    onPickup: (spot) => {
      if (collected.has(spot.id) || !hero.addItem(spot.itemId)) return;
      collected.add(spot.id);
      sfx.play('pick');
      toast.show(`+1 ${getItem(spot.itemId)?.name ?? spot.itemId}`);
      setDirty(true);
      handleCompletions(sideQuests.onEvent({ type: 'collect' }));
    },
    onLocationEnter: (locationId) => handleCompletions(sideQuests.onEvent({ type: 'visit', locationId })),
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
