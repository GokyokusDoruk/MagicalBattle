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
import { Carry } from './inventory/carry';
import { applyDrop, dropCandidates } from './inventory/exitDrop';
import { GroundLoot } from './world/groundLoot';
import { locationAt } from './save/cityEntry';
import { ExitDropUi } from './ui/exitDropUi';
import { GroundPileUi } from './ui/groundPileUi';
import { STARTER_WAND_ID } from './wands/catalog';
import { WandInventory } from './wands/inventory';
import { WandStock } from './wands/stock';
import { GearStock } from './economy/gearStock';
import { BagUi } from './ui/bagUi';
import { chapterChoiceTrees, linesTree } from './dialogue/moralDialogues';
import { finalLines } from './morality/final';
import { Morality } from './morality/morality';
import { getBoss } from './boss/bosses';
import { goldLoss, nearestHealer, respawnLines } from './economy/death';
import { DialogueUi } from './ui/dialogueUi';
import { runBossFight } from './ui/bossFight';
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
import { LOCATIONS, getLocation } from './world/locations';
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
// Envanter ağırlığı: çanta, Taşıyıcı yeteneği ve başlangıç kapasitesi (3 asa, 20 eşya, 2 kuşanılabilir)
wands.setLevelProvider(() => hero.level);
/** Bulunulan konum (şehir, köy, arena) ya da açık dünya (null). Kendi elementinin çantası ve ayakkabısı burada %50 güçlüdür. */
let currentLocationId: string | null = null;
const elementsHere = () => (currentLocationId ? getLocation(currentLocationId).elements : []);
const carry = new Carry(hero, wands, () => skillTree.carryBonus, elementsHere);
carry.install();
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
} else {
  // Yeni oyun: eşyasız başlanır, yalnızca bir asa verilir
  wands.add(STARTER_WAND_ID);
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
const wandUi = new WandUi({ wands, level: () => hero.level, onChanged: () => setDirty(true) });
document.body.appendChild(wandUi.element);
/** Şehirde kullanılan bonusun açıklaması (çanta ekranında gösterilir) */
const locationNote = (): string | null => {
  const loc = currentLocationId ? getLocation(currentLocationId) : null;
  if (!loc || loc.elements.length === 0) return null;
  const bag = hero.equipped.bag ? getItem(hero.equipped.bag) : undefined;
  const boots = hero.equipped.boots ? getItem(hero.equipped.boots) : undefined;
  const active = [bag, boots].filter((i) => i?.element && loc.elements.includes(i.element)).map((i) => i!.name);
  return active.length > 0 ? `${loc.name}: ${active.join(' ve ')} burada %50 daha güçlü (şehir bonusu).` : `${loc.name}: kendi elementinin çantası ve ayakkabısı burada %50 daha güçlüdür.`;
};
const bagUi = new BagUi({ player: hero, wands, carry, locationNote, onChanged: () => setDirty(true) });
document.body.appendChild(bagUi.element);
/** Şehirden çıkarken bırakılan ve sığmayan eşyalar yerde 10 dakika kalır */
const ground = new GroundLoot(() => performance.now());
const groundPileUi = new GroundPileUi({ ground, player: hero, wands, onChanged: () => setDirty(true) });
document.body.appendChild(groundPileUi.element);
const exitDropUi = new ExitDropUi();
document.body.appendChild(exitDropUi.element);
/** Başka bir panel (sahne, tüccar, diyalog ya da diğer çekmeceler) açıkken yeni panel açılmaz */
const otherOpen = (except: { isOpen: boolean }): boolean =>
  [story, merchantUi, dialogueUi, skillUi, wandUi, bagUi, groundPileUi, exitDropUi].some((p) => p !== except && p.isOpen);
const statusBar = new StatusBar(
  () => {
    if (!otherOpen(skillUi)) skillUi.toggle();
  },
  () => {
    if (!otherOpen(wandUi)) wandUi.toggle();
  },
  () => {
    if (!otherOpen(bagUi)) bagUi.toggle();
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
    bagSummary: `Asa ${carry.usage().wands}/${carry.capacity().wands} · Eşya ${carry.usage().goods}/${carry.capacity().goods}`,
    bagFull: carry.isOverloaded() || carry.room('wands') === 0 || carry.room('goods') === 0,
    moralityLabel: `${morality.effects.label} (${morality.score > 0 ? '+' : ''}${morality.score})`,
  });
const setDirty = (value: boolean): void => {
  dirty = value;
  refreshHud();
};
hero.onChange(refreshHud);
hero.onChange(() => wandUi.isOpen && wandUi.refresh()); // seviye değişince asa seviye şartları güncellenir
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
    if (c.overflowGold > 0) parts.push(`çanta dolu: sığmayan eşyalar +${c.overflowGold} altına çevrildi`);
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

// Tüccarların asa stokları: her tüccarın kendi stoğu, 5 dakikada bir yenilenir (oyun süresiyle)
const wandStocks = new Map<string, WandStock>();
const wandStock = (merchantId: string): WandStock => {
  let stock = wandStocks.get(merchantId);
  if (!stock) {
    stock = new WandStock(merchantId, () => performance.now(), () => hero.level);
    wandStocks.set(merchantId, stock);
  }
  return stock;
};

const gearStocks = new Map<string, GearStock>();
const gearStock = (merchantId: string): GearStock => {
  let stock = gearStocks.get(merchantId);
  if (!stock) {
    stock = new GearStock(merchantId, () => performance.now());
    gearStocks.set(merchantId, stock);
  }
  return stock;
};

const merchantUi = new MerchantUi({
  player: hero,
  quests: sideQuests,
  wands,
  wandStock,
  gearStock,
  sfx,
  priceMultipliers: () => ({ buy: morality.effects.buyMultiplier, sell: morality.effects.sellMultiplier }),
  onChanged: () => setDirty(true),
  onQuestCompletion: (c) => handleCompletions([c]),
});
document.body.appendChild(merchantUi.element);
const dialogueUi = new DialogueUi(narrator);
document.body.appendChild(dialogueUi.element);
/** Bir bölümün sahnesi, boss savaşı ve seçimleri sürerken true (aralardaki boşlukta da dünya durur) */
let chapterBusy = false;
const modalOpen = (): boolean =>
  chapterBusy || story.isOpen || merchantUi.isOpen || skillUi.isOpen || wandUi.isOpen || bagUi.isOpen || dialogueUi.isOpen || groundPileUi.isOpen || exitDropUi.isOpen;

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

/**
 * Ölüm (boss savaşında yenilip pes etmek): altının seviyeye göre bir kısmı kaybolur, en yakın köyün şifacısının
 * yanında ayılırsın. XP, seviye, eşya, asa ve ekipman korunur. (Task 20, docs/olum-ve-ekonomi.md)
 */
async function handleDeath(): Promise<void> {
  const spot = nearestHealer(debug.player.x / TILE_SIZE, debug.player.y / TILE_SIZE);
  const lost = goldLoss(hero.level, hero.gold);
  if (lost > 0) hero.spendGold(lost);
  setDirty(true);
  sfx.play('lose');
  if (!spot) return;
  pendingTeleport = { x: spot.tileX * TILE_SIZE + TILE_SIZE / 2, y: spot.tileY * TILE_SIZE + TILE_SIZE / 2 };
  const ctx = { score: () => morality.score, flags: new Set<string>(), onEffect: (): void => {} };
  await dialogueUi.run(linesTree('respawn', respawnLines(spot, lost, hero.level)), ctx);
}

/** Sahne bu oturumda izlendi mi (yenilgiden sonra tekrar denerken sahne baştan oynamasın) */
const scenesSeen = new Set<number>();

/**
 * Bir bölümün akışı: sahne → boss savaşı → ahlak seçimleri → bölüm tamamlanır.
 * Bölüm 8'de seçimler ve final sahnesi bosstan ÖNCE gelir (final yolu seçimlere göre belirlenir).
 * Boss yenilirse ya da geri çekilirsen bölüm tamamlanmaz; işaretçiye tekrar girip yeniden denersin.
 */
async function playChapter(chapter: number): Promise<void> {
  const scene = CHAPTER_SCENES[chapter];
  if (!scene) return;
  chapterBusy = true;
  try {
    if (!scenesSeen.has(chapter)) {
      await story.play(scene);
      scenesSeen.add(chapter);
    }
    const boss = getBoss(chapter);
    if (chapter === 8) await playChapterChoices(8);
    if (boss) {
      const ctx = { score: () => morality.score, flags: new Set<string>(), onEffect: (): void => {} };
      await dialogueUi.run(linesTree(`boss-${chapter}`, boss.intro), ctx);
      const outcome = await runBossFight(
        chapter,
        { name: playerName, level: hero.level, armor: hero.armor, gear: hero.gearResolver, spells: skillTree.resolver, wands: wands.resolver },
        morality.finalPath,
      );
      if (outcome !== 'won') {
        if (outcome === 'lost') {
          toast.show(`${boss.title} seni yendi.`);
          await handleDeath();
        } else {
          toast.show('Geri çekildin. Hazır olunca tekrar gel.');
        }
        return;
      }
      hero.addGold(boss.reward.gold);
      const levels = hero.addXp(boss.reward.xp);
      toast.show(`${boss.title} yenildi! +${boss.reward.gold} altın, +${boss.reward.xp} XP`);
      sfx.play('victory');
      if (levels > 0) window.setTimeout(() => toast.show(`Seviye atladın! Seviye ${hero.level}. Yetenek puanın: ${skillTree.pointsFree} (K)`), 2800);
      setDirty(true);
      handleCompletions(sideQuests.onEvent({ type: 'battleWon' }));
    }
    if (chapter !== 8) await playChapterChoices(chapter);
    progress.completeChapter(chapter);
  } finally {
    chapterBusy = false;
  }
}
// K: yetenek ağacı, W: asalar (sahne ya da tüccar açıkken açılmaz)
window.addEventListener('keydown', (e) => {
  if (e.repeat || story.isOpen || merchantUi.isOpen || dialogueUi.isOpen || exitDropUi.isOpen) return;
  if (e.code === 'KeyK' && !otherOpen(skillUi)) skillUi.toggle();
  if (e.code === 'KeyW' && !otherOpen(wandUi)) wandUi.toggle();
  if (e.code === 'KeyB' && !otherOpen(bagUi)) bagUi.toggle();
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
  carry,
  bagUi,
  ground,
  groundPileUi,
  exitDropUi,
  handleLocationChange,
  morality,
  dialogueUi,
  playChapterChoices,
  playChapter,
  handleDeath,
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
{
  const t = startPoint ?? map.spawn;
  currentLocationId = locationAt(map.locations, t.x, t.y);
}

let exitBusy = false;

/**
 * Konum değişti. Şehirden (köyden) çıkınca çantanın şehir bonusu gider; taşıdıkların yeni kapasiteye sığmıyorsa oyuncuya
 * hangilerini bırakmak istediği sorulur (bırakılanlar çıkış noktasında yerde 10 dakika kalır) ya da şehre geri döner.
 */
async function handleLocationChange(from: string | null, to: string | null): Promise<void> {
  currentLocationId = to;
  refreshHud();
  if (!from || exitBusy || !carry.isOverloaded()) return;
  exitBusy = true;
  try {
    const overflow = carry.overflow();
    const result = await exitDropUi.prompt({
      locationName: getLocation(from).name,
      overflow,
      candidates: dropCandidates(hero, wands),
      capacity: carry.capacity(),
      usage: carry.usage(),
    });
    if (result.action === 'drop') {
      const tx = Math.floor(debug.player.x / TILE_SIZE);
      const ty = Math.floor(debug.player.y / TILE_SIZE);
      const pile = applyDrop(hero, wands, overflow, result.selection, ground, tx, ty);
      if (pile) {
        const n = Object.values(pile.items).reduce((a, b) => a + b, 0) + Object.values(pile.wands).reduce((a, b) => a + b, 0);
        toast.show(`${n} eşya yere bırakıldı. 10 dakika içinde geri alabilirsin.`);
        setDirty(true);
      }
    } else {
      // Şehre geri dön: merkeze ışınlan, satıp boşalt
      const loc = getLocation(from);
      pendingTeleport = { x: loc.x * TILE_SIZE + TILE_SIZE / 2, y: loc.y * TILE_SIZE + TILE_SIZE / 2 };
      toast.show('Şehre geri döndün. Eşyalarını sat ya da at, sonra çık.');
    }
  } finally {
    exitBusy = false;
  }
}

void import('./world/bootWorld').then((m) =>
  m.bootWorld(document.querySelector('#world')!, {
    map,
    startTile: startPoint,
    // Sahne ya da tüccar ekranı açıkken karakter durur
    getAxis: () => (modalOpen() ? STILL : input.getAxis()),
    // Ayakkabı yürüme hızını artırır; kendi elementinin şehrinde (köyde iki elementten biri) %50 daha çok
    getSpeedMultiplier: () => 1 + hero.speedBonusIn(elementsHere()),
    gates,
    quests,
    notify: (message) => toast.show(message),
    onMarkerEnter: (marker) => {
      const scene = CHAPTER_SCENES[marker.chapter];
      if (modalOpen() || !scene) return;
      // Sahne, boss savaşı ve seçimler bitince bölüm tamamlanır: kapı açılır, sonraki görev belirir.
      void playChapter(marker.chapter);
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
      if (collected.has(spot.id)) return;
      if (!hero.addItem(spot.itemId)) {
        toast.show('Çantan dolu: bu eşyayı alamazsın. Şehirde satıp boşalt (B).');
        return;
      }
      collected.add(spot.id);
      sfx.play('pick');
      toast.show(`+1 ${getItem(spot.itemId)?.name ?? spot.itemId}`);
      setDirty(true);
      handleCompletions(sideQuests.onEvent({ type: 'collect' }));
    },
    onLocationEnter: (locationId) => handleCompletions(sideQuests.onEvent({ type: 'visit', locationId })),
    onLocationChange: (from, to) => void handleLocationChange(from, to),
    groundPiles: () => ground.piles(),
    onPileEnter: (id) => {
      if (!modalOpen()) groundPileUi.open(id);
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
