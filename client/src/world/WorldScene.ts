import * as Phaser from 'phaser';
import type { Axis } from '../input/axis';
import { GridMover } from './gridMove';
import { isLockedGateAt, type GateRegistry } from './gates';
import { tileAt, type WorldMap } from './generateMap';
import { enemyTitle } from '../enemies/catalog';
import { DANGER_ZONES } from '../enemies/dangerZones';
import { CityEntryTracker, cityAt, locationAt } from '../save/cityEntry';
import type { MerchantSpot } from './merchantSpots';
import type { EnemySpot } from '../enemies/spots';
import type { MineSpot } from '../enemies/mines';
import type { ChestSpot } from '../enemies/chests';
import { MAIN_QUEST_MARKERS, markersInRange, type MainQuestMarker, type QuestTracker } from './questMarkers';
import { BUSH_KEY, STAFF_KEY, CHEST_KEY, QUEST_FLAG_KEY, QUEST_RING_KEY, enemyKey, mineKey, PILE_KEY, PLAYER_KEY, STALL_KEY, createPlayerTexture, createWorldItemTextures } from './textures';
import { Tile, TILE_SIZE, isBlockedTile } from './tiles';

const GATE_NOTICE_RANGE = TILE_SIZE * 1.6;
const GATE_NOTICE_COOLDOWN_MS = 3000;
const MARKER_TRIGGER_RANGE = TILE_SIZE * 0.9;
const MERCHANT_RANGE = TILE_SIZE * 1.6;
const PILE_RANGE = TILE_SIZE * 0.9;
const ENEMY_RANGE = TILE_SIZE * 0.8;

/** Dünyanın dışarıyla (arayüz, durum) konuştuğu her şey. */
/** Düşman isim etiketlerinin rengi (elementine göre: ateş kırmızı, su mavi, toprak kahverengi, hava beyaz) */
const ENEMY_LABEL_COLORS: Record<string, string> = { fire: '#fca5a5', water: '#93c5fd', earth: '#e0b36a', air: '#f8fafc' };

export interface WorldContext {
  map: WorldMap;
  /** Yumuşak arazi görseli (world/terrainTexture.ts); harita bununla çizilir */
  terrain: HTMLCanvasElement;
  getAxis: () => Axis;
  /** Yürüme hızı çarpanı (1 = normal); ayakkabıdan gelir. Verilmezse 1. */
  getSpeedMultiplier?: () => number;
  gates: GateRegistry;
  quests: QuestTracker;
  /** Ekranda kısa bildirim göster */
  notify: (message: string) => void;
  /** Oyuncu aktif bir ana görev işaretine ulaştı (sahne burada başlatılır) */
  onMarkerEnter: (marker: MainQuestMarker) => void;
  /** Her karede oyuncunun dünya konumu (piksel) */
  onFrame?: (player: { x: number; y: number }) => void;
  /** Oyunun başlayacağı karo (kayıttan devam); yoksa haritanın başlangıç noktası */
  startTile?: { x: number; y: number };
  /** Oyuncu bir şehrin surlarının içine yeni girdi (kayıt noktası) */
  onCityEnter?: (cityId: string) => void;
  /** Köylerdeki tüccarlar; oyuncu yanlarına gelince `onMerchantEnter` çağrılır */
  merchants?: readonly MerchantSpot[];
  onMerchantEnter?: (merchantId: string) => void;
  /** Oyuncu bir konumun (şehir, köy, arena) alanına yeni girdi */
  onLocationEnter?: (locationId: string) => void;
  /** Oyuncunun bulunduğu konum değişti (`null` = açık dünya): şehre girme, şehirden çıkma ve konumlar arası geçiş */
  onLocationChange?: (from: string | null, to: string | null) => void;
  /** Yerdeki eşya yığınları (şehirden çıkarken bırakılanlar); yığına yaklaşınca `onPileEnter` çağrılır */
  groundPiles?: () => readonly { id: string; tileX: number; tileY: number }[];
  onPileEnter?: (pileId: string) => void;
  /** Dünya düşmanları (Task 28); oyuncu yanlarına gelince `onEnemyEnter` çağrılır. Yenilenler `isEnemyActive` ile gizlenir. */
  enemies?: readonly EnemySpot[];
  isEnemyActive?: (id: string) => boolean;
  onEnemyEnter?: (id: string) => void;
  /** Madenler (Task 30); oyuncu girişe gelince `onMineEnter`. `isMineReady` false ise sönük çizilir. */
  mines?: readonly MineSpot[];
  isMineReady?: (id: string) => boolean;
  onMineEnter?: (id: string) => void;
  /** Korumalı sandıklar (Task 31); açılanlar `isChestOpen` ile gizlenir, yanlarına gelince `onChestEnter`. */
  chests?: readonly ChestSpot[];
  isChestOpen?: (id: string) => boolean;
  onChestEnter?: (id: string) => void;
  /** Oyuncu yeni bir karoya girdi (bölge savaşları için) */
  onTileEnter?: (tileX: number, tileY: number) => void;
  /** Oyuncuyu bir dünya konumuna (piksel) ışınlar; kayıt yükleme ve geliştirme denemeleri için. Boşsa null. */
  takeTeleport?: () => { x: number; y: number } | null;
}

/** Açık dünya: harita, oyuncu hareketi, çarpışma, kamera, kapılar ve ana görev işaretleri. */
export class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  /** Karakterin asası: yürürken aşağı yukarı sallanır, dururken hafifçe salınır */
  private staff!: Phaser.GameObjects.Image;
  private pos = { x: 0, y: 0 };
  /** Asa sallanma şiddeti (0 durur, 1 yürür); yumuşak geçiş için */
  private staffMove = 0;
  /** Çalılıkta karakterin önünde duran yaprak kümeleri (havuz): karakterin alt yarısı çalının içinde görünür */
  private bushes: Phaser.GameObjects.Image[] = [];
  /** Kare kare hareket (Task 39) */
  private mover!: GridMover;
  private markerSprites = new Map<string, Phaser.GameObjects.Container>();
  /** Düşman isim etiketleri: oyuncu yaklaşınca görünür (seviye ve element) */
  private enemyLabels = new Map<string, Phaser.GameObjects.Text>();
  private insideMarkers = new Set<string>();
  private lastGateNotice = new Map<string, number>();
  private cityTracker = new CityEntryTracker();
  private locationTracker = new CityEntryTracker();
  private insideMerchants = new Set<string>();
  private currentLocation: string | null = null;
  private pileSprites = new Map<string, Phaser.GameObjects.Image>();
  private insidePiles = new Set<string>();
  private enemySprites = new Map<string, Phaser.GameObjects.Image>();
  private insideEnemies = new Set<string>();
  private chestSprites = new Map<string, Phaser.GameObjects.Image>();
  private insideChests = new Set<string>();
  private mineSprites = new Map<string, Phaser.GameObjects.Image>();
  private insideMines = new Set<string>();

  constructor(private readonly ctx: WorldContext) {
    super('world');
  }

  create(): void {
    const { map } = this.ctx;

    createPlayerTexture(this);
    createWorldItemTextures(this);

    // Zemin: yumuşak arazi görseli (karolu mantığın üstüne çizilen organik görünüm), doğrusal süzme ile
    const terrain = this.textures.addCanvas('terrain', this.ctx.terrain)!;
    terrain.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.add.image(0, 0, 'terrain').setOrigin(0, 0).setDisplaySize(map.width * TILE_SIZE, map.height * TILE_SIZE).setDepth(0);

    this.createLocationLabels();
    this.createMarkerSprites();
    this.createMerchants();
    this.createDangerZones();
    this.createEnemies();
    this.createMines();
    this.createChests();

    const start = this.ctx.startTile ?? map.spawn;
    const { map: m0, gates: g0 } = this.ctx;
    this.mover = new GridMover(
      { x: start.x, y: start.y },
      (tx, ty) => isBlockedTile(tileAt(m0, tx, ty)) || isLockedGateAt(m0.gates, g0, tx, ty),
      (tile) => this.ctx.onTileEnter?.(tile.x, tile.y),
    );
    this.pos = this.mover.position();
    // Kayıttan şehrin içinde başlanıyorsa bu yeni bir "giriş" sayılmaz (tekrar kayıt tetiklenmesin)
    this.cityTracker = new CityEntryTracker(cityAt(map.locations, start.x, start.y));
    this.locationTracker = new CityEntryTracker(locationAt(map.locations, start.x, start.y));
    this.currentLocation = locationAt(map.locations, start.x, start.y);
    this.player = this.add.image(this.pos.x, this.pos.y, PLAYER_KEY).setOrigin(0.5, 0.5).setDepth(10);
    this.staff = this.add.image(this.pos.x, this.pos.y, STAFF_KEY).setOrigin(0.5, 1).setDepth(10.5);
    this.placeStaff(0);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.width * TILE_SIZE, map.height * TILE_SIZE);
    cam.startFollow(this.player, true, 0.12, 0.12);
    this.applyZoom();
    this.scale.on('resize', () => this.applyZoom());
  }

  private createLocationLabels(): void {
    for (const loc of this.ctx.map.locations) {
      const above = loc.kind === 'city' ? 8 : 5;
      this.add
        .text(loc.x * TILE_SIZE + TILE_SIZE / 2, (loc.y - above) * TILE_SIZE, loc.name, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(5);
    }
  }

  /** Sarı [!] işaretleri; yalnızca aktif bölümlerinki görünür ve hafifçe sallanır. */
  private createMarkerSprites(): void {
    // Ana görev işareti: altın bayrak, yerde nabız gibi atan halka (Task 60; eskiden sarı "!" yazısıydı)
    for (const m of MAIN_QUEST_MARKERS) {
      const ring = this.add.image(0, 2, QUEST_RING_KEY);
      const flag = this.add.image(0, -4, QUEST_FLAG_KEY).setOrigin(0.5, 1);
      const sprite = this.add.container(m.px, m.py + 8, [ring, flag]).setDepth(8);
      this.tweens.add({ targets: flag, y: -8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: ring, scaleX: 1.25, scaleY: 1.25, alpha: 0.45, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.markerSprites.set(m.id, sprite);
    }
  }

  /** Küçük ekranda da yeterince karo görünsün diye ekrana göre yakınlaştırır. */
  private applyZoom(): void {
    const shortSide = Math.min(this.scale.width, this.scale.height);
    this.cameras.main.setZoom(Phaser.Math.Clamp(shortSide / 360, 1.25, 2.5));
  }

  update(time: number, delta: number): void {
    const teleport = this.ctx.takeTeleport?.();
    if (teleport) {
      this.mover.teleport({ x: Math.floor(teleport.x / TILE_SIZE), y: Math.floor(teleport.y / TILE_SIZE) });
      this.pos = this.mover.position();
      this.player.setPosition(this.pos.x, this.pos.y);
    }
    this.movePlayer(delta);
    this.placeStaff(time);
    this.updateBushes(time);
    this.updateEnemyLabels();
    this.checkGates(time);
    this.checkMarkers();
    this.checkCityEntry();
    this.checkLocationEntry();
    this.syncPiles();
    this.checkMerchants();
    this.checkEnemies();
    this.checkMines();
    this.checkChests();
    this.ctx.onFrame?.({ x: this.pos.x, y: this.pos.y });
  }

  /**
   * Çalılık karolarında karakterin önüne yaprak kümesi koyar (karakterin alt yarısı çalıda gibi görünür). Oyuncunun bulunduğu satır,
   * üç karo genişliğinde taranır; çalı olan her karoya bir küme çizilir ve hafifçe sallanır. Havuz yeniden kullanılır.
   */
  private updateBushes(time: number): void {
    const { map } = this.ctx;
    const tx = Math.floor(this.pos.x / TILE_SIZE);
    const ty = Math.floor(this.pos.y / TILE_SIZE);
    let used = 0;
    for (let dy = 0; dy <= 0; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = tx + dx;
        const y = ty + dy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height || tileAt(map, x, y) !== Tile.Thicket) continue;
        let img = this.bushes[used];
        if (!img) {
          img = this.add.image(0, 0, BUSH_KEY).setOrigin(0.5, 1).setDepth(11);
          this.bushes.push(img);
        }
        const sway = Math.sin(time / 420 + x * 1.7 + y) * 0.9;
        img.setPosition(x * TILE_SIZE + TILE_SIZE / 2 + sway, (y + 1) * TILE_SIZE);
        img.setVisible(true);
        used++;
      }
    }
    for (let i = used; i < this.bushes.length; i++) this.bushes[i].setVisible(false);
  }

  /**
   * Tehlikeli bölgeler (Task 62): yerde nabız gibi atan kırmızı bir alan, kenarda kırmızı halka ve ortada kafatası ile bölgenin adı.
   * Alan zeminin üstünde ama karakterin ve düşmanların altında çizilir (karakter bölgenin içinde de görünür kalır).
   */
  private createDangerZones(): void {
    for (const z of DANGER_ZONES) {
      const cx = z.tileX * TILE_SIZE + TILE_SIZE / 2;
      const cy = z.tileY * TILE_SIZE + TILE_SIZE / 2;
      const r = z.radius * TILE_SIZE;
      const area = this.add.graphics().setDepth(1);
      area.fillStyle(0xb91c1c, 0.16).fillCircle(cx, cy, r);
      area.fillStyle(0x7f1d1d, 0.12).fillCircle(cx, cy, r * 0.72);
      area.lineStyle(3, 0xef4444, 0.75).strokeCircle(cx, cy, r);
      area.lineStyle(1.5, 0xfecaca, 0.5).strokeCircle(cx, cy, r * 0.97);
      this.tweens.add({ targets: area, alpha: 0.55, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add
        .text(cx, cy - 4, '☠', { fontFamily: 'system-ui, sans-serif', fontSize: '34px', color: '#fecaca', stroke: '#450a0a', strokeThickness: 5 })
        .setOrigin(0.5)
        .setDepth(3)
        .setAlpha(0.85);
      this.add
        .text(cx, cy + 22, `⚠ ${z.name}`, { fontFamily: 'system-ui, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#fecaca', stroke: '#450a0a', strokeThickness: 4 })
        .setOrigin(0.5)
        .setDepth(3);
      // Kenarda birkaç küçük kafatası (alan sınırı belli olsun)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.3;
        this.add
          .text(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97, '☠', { fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#fca5a5', stroke: '#450a0a', strokeThickness: 3 })
          .setOrigin(0.5)
          .setDepth(2)
          .setAlpha(0.8);
      }
    }
  }

  /** Düşman isimleri yalnızca yaklaşınca görünür ("5. seviye Ateş Büyücüsü"); uzaktakiler ve yenilenler gizli. */
  private updateEnemyLabels(): void {
    for (const spot of this.ctx.enemies ?? []) {
      const label = this.enemyLabels.get(spot.id);
      if (!label) continue;
      const near = Math.hypot(spot.tileX * TILE_SIZE + TILE_SIZE / 2 - this.pos.x, spot.tileY * TILE_SIZE + TILE_SIZE / 2 - this.pos.y) <= TILE_SIZE * 7;
      label.setVisible(near && (this.ctx.isEnemyActive?.(spot.id) ?? true));
    }
  }

  /** Kare kare yürür: yön girdisi karo karo adımlara çevrilir, hız çarpanı (ayakkabı, hava asası) adımı kısaltır. */
  private movePlayer(delta: number): void {
    this.mover.update(delta, this.ctx.getAxis(), this.ctx.getSpeedMultiplier?.() ?? 1);
    this.pos = this.mover.position();
    this.player.setPosition(this.pos.x, this.pos.y);
    if (this.mover.facing === 'left') this.player.setFlipX(true);
    else if (this.mover.facing === 'right') this.player.setFlipX(false);
  }

  /**
   * Asa karakterin yanında durur (yüz yönüne göre sağda ya da solda). Yürürken yukarı aşağı oynar ve hafifçe sallanır; dururken yavaşça salınır.
   * Hareket bitince asa kendi yerine döner (anlık zıplama yok: salınım sıfıra yumuşakça iner).
   */
  private placeStaff(time: number): void {
    const left = this.player.flipX;
    const walking = this.mover.moving;
    const target = walking ? 1 : 0;
    this.staffMove += (target - this.staffMove) * 0.2;
    const bob = Math.sin(time / 85) * 3 * this.staffMove + Math.sin(time / 700) * 0.7 * (1 - this.staffMove);
    const tilt = Math.sin(time / 85 + 1) * 0.16 * this.staffMove + Math.sin(time / 700) * 0.04;
    // Karakter karoyu doldurur; asa karonun kenarında, alt ucu karonun dibinde (karodan taşmaz)
    this.staff.setPosition(this.pos.x + (left ? -11 : 11), this.pos.y + 14 + bob * 0.6);
    this.staff.setRotation(left ? -tilt : tilt);
  }

  /** Kilitli bir kapıya yaklaşınca (sık tekrarlamadan) uyarı verir. */
  private checkGates(now: number): void {
    const { map, gates } = this.ctx;
    for (const gate of map.gates) {
      if (gates.isUnlocked(gate.cityId)) continue;
      const gx = gate.x * TILE_SIZE + TILE_SIZE / 2;
      const gy = gate.y * TILE_SIZE + TILE_SIZE / 2;
      if (Math.hypot(gx - this.pos.x, gy - this.pos.y) > GATE_NOTICE_RANGE) continue;
      const last = this.lastGateNotice.get(gate.cityId) ?? -Infinity;
      if (now - last < GATE_NOTICE_COOLDOWN_MS) continue;
      this.lastGateNotice.set(gate.cityId, now);
      const city = map.locations.find((l) => l.id === gate.cityId)!;
      const next = this.ctx.quests.activeMarkers()[0];
      this.ctx.notify(
        next
          ? `${city.name} kapısı kilitli. Önce ana görevi yap: «${next.title}» (sarı ! işareti, ${map.locations.find((l) => l.id === next.locationId)?.name ?? ''}).`
          : `${city.name} kapısı kilitli. Bu bölgenin ana görevini tamamla.`,
      );
    }
  }

  /** Tüccar tezgâhları ve isimleri. */
  private createMerchants(): void {
    for (const spot of this.ctx.merchants ?? []) {
      const x = spot.tileX * TILE_SIZE + TILE_SIZE / 2;
      const y = spot.tileY * TILE_SIZE + TILE_SIZE / 2;
      this.add.image(x, y, STALL_KEY).setOrigin(0.5, 0.75).setDepth(4);
      this.add
        .text(x, y - 38, spot.merchant.name, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#ffe9a8',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(5);
    }
  }

  /** Dünya düşmanları: elementine göre renkli yaratıklar, hafifçe sallanır. */
  private createEnemies(): void {
    for (const spot of this.ctx.enemies ?? []) {
      const x = spot.tileX * TILE_SIZE + TILE_SIZE / 2;
      const y = spot.tileY * TILE_SIZE + TILE_SIZE / 2;
      // Büyücü tam bir karoyu doldurur (Faz 1); kademe adının renginden ve yazısından anlaşılır
      const sprite = this.add.image(x, y, enemyKey(spot.element)).setOrigin(0.5, 0.5).setDepth(6).setDisplaySize(TILE_SIZE * (34 / 44), TILE_SIZE);
      this.tweens.add({ targets: sprite, y: y - 1.5, duration: 600 + (spot.tileX % 4) * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.enemySprites.set(spot.id, sprite);
      const label = this.add
        .text(x, y - 30, enemyTitle(spot.element, spot.tier), { fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: ENEMY_LABEL_COLORS[spot.element], stroke: '#000000', strokeThickness: 3 })
        .setOrigin(0.5)
        .setDepth(7)
        .setVisible(false);
      this.enemyLabels.set(spot.id, label);
    }
  }

  /** Madenler: elementine göre renkli giriş ve isim. */
  private createMines(): void {
    for (const m of this.ctx.mines ?? []) {
      const x = m.tileX * TILE_SIZE + TILE_SIZE / 2;
      const y = m.tileY * TILE_SIZE + TILE_SIZE / 2;
      this.mineSprites.set(m.id, this.add.image(x, y, mineKey(m.element)).setOrigin(0.5, 0.8).setDepth(4));
      this.add
        .text(x, y - 34, m.name, { fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#fde68a', stroke: '#000000', strokeThickness: 3 })
        .setOrigin(0.5)
        .setDepth(5);
    }
  }

  /** Dinlenen madenleri soluk gösterir; girişe gelince (bir kez, uzaklaşıp dönene kadar) haber verir. */
  private checkMines(): void {
    const near = new Set<string>();
    for (const m of this.ctx.mines ?? []) {
      this.mineSprites.get(m.id)?.setAlpha(this.ctx.isMineReady?.(m.id) === false ? 0.45 : 1);
      const x = m.tileX * TILE_SIZE + TILE_SIZE / 2;
      const y = m.tileY * TILE_SIZE + TILE_SIZE / 2;
      if (Math.hypot(x - this.pos.x, y - this.pos.y) <= TILE_SIZE * 0.9) near.add(m.id);
    }
    for (const id of near) if (!this.insideMines.has(id)) this.ctx.onMineEnter?.(id);
    this.insideMines = near;
  }

  /** Korumalı sandıklar: hafifçe parlar, açılınca kaybolur. */
  private createChests(): void {
    for (const c of this.ctx.chests ?? []) {
      const x = c.tileX * TILE_SIZE + TILE_SIZE / 2;
      const y = c.tileY * TILE_SIZE + TILE_SIZE / 2;
      const sprite = this.add.image(x, y, CHEST_KEY).setDepth(4);
      this.tweens.add({ targets: sprite, scale: 1.08, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.chestSprites.set(c.id, sprite);
    }
  }

  private checkChests(): void {
    const near = new Set<string>();
    for (const c of this.ctx.chests ?? []) {
      const open = this.ctx.isChestOpen?.(c.id) ?? false;
      this.chestSprites.get(c.id)?.setVisible(!open);
      if (open) continue;
      const x = c.tileX * TILE_SIZE + TILE_SIZE / 2;
      const y = c.tileY * TILE_SIZE + TILE_SIZE / 2;
      if (Math.hypot(x - this.pos.x, y - this.pos.y) <= TILE_SIZE * 0.9) near.add(c.id);
    }
    for (const id of near) if (!this.insideChests.has(id)) this.ctx.onChestEnter?.(id);
    this.insideChests = near;
  }

  /** Yenilen düşmanı gizler (geri gelince yeniden gösterir); yanına gelince (bir kez, uzaklaşıp dönene kadar) savaşı başlatır. */
  private checkEnemies(): void {
    const near = new Set<string>();
    for (const spot of this.ctx.enemies ?? []) {
      const sprite = this.enemySprites.get(spot.id);
      const active = this.ctx.isEnemyActive?.(spot.id) ?? true;
      sprite?.setVisible(active);
      if (!active) continue;
      const x = spot.tileX * TILE_SIZE + TILE_SIZE / 2;
      const y = spot.tileY * TILE_SIZE + TILE_SIZE / 2;
      if (Math.hypot(x - this.pos.x, y - this.pos.y) <= ENEMY_RANGE) near.add(spot.id);
    }
    for (const id of near) if (!this.insideEnemies.has(id)) this.ctx.onEnemyEnter?.(id);
    this.insideEnemies = near;
  }

  /** Bir konumun alanına yeni girildiğinde haber verir (ziyaret görevleri). */
  private checkLocationEntry(): void {
    const id = locationAt(this.ctx.map.locations, Math.floor(this.pos.x / TILE_SIZE), Math.floor(this.pos.y / TILE_SIZE));
    const entered = this.locationTracker.update(id);
    if (entered) this.ctx.onLocationEnter?.(entered);
    if (id !== this.currentLocation) {
      const from = this.currentLocation;
      this.currentLocation = id;
      this.ctx.onLocationChange?.(from, id);
    }
  }

  /** Yerdeki eşya yığınlarının sprite'larını oyunla eşler (yeni gelen çizilir, kaybolan silinir) ve yaklaşmayı bildirir. */
  private syncPiles(): void {
    const piles = this.ctx.groundPiles?.() ?? [];
    const alive = new Set(piles.map((p) => p.id));
    for (const [id, sprite] of this.pileSprites) {
      if (alive.has(id)) continue;
      this.pileSprites.delete(id);
      this.tweens.add({ targets: sprite, alpha: 0, duration: 300, onComplete: () => sprite.destroy() });
    }
    const near = new Set<string>();
    for (const p of piles) {
      const x = p.tileX * TILE_SIZE + TILE_SIZE / 2;
      const y = p.tileY * TILE_SIZE + TILE_SIZE / 2;
      const within = Math.hypot(x - this.pos.x, y - this.pos.y) <= PILE_RANGE;
      if (!this.pileSprites.has(p.id)) {
        // Yeni görünen yığının üstündeysek (az önce biz bıraktık) kendiliğinden açılmaz: uzaklaşıp dönmek gerekir
        if (within) this.insidePiles.add(p.id);
        const sprite = this.add.image(x, y, PILE_KEY).setDepth(3);
        this.tweens.add({ targets: sprite, y: y - 3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.pileSprites.set(p.id, sprite);
      }
      if (within) near.add(p.id);
    }
    for (const id of near) if (!this.insidePiles.has(id)) this.ctx.onPileEnter?.(id);
    this.insidePiles = near;
  }

  /** Tüccarın yanına gelince (bir kez, uzaklaşıp dönene kadar) alışveriş ekranını açtırır. */
  private checkMerchants(): void {
    const near = new Set<string>();
    for (const spot of this.ctx.merchants ?? []) {
      const x = spot.tileX * TILE_SIZE + TILE_SIZE / 2;
      const y = spot.tileY * TILE_SIZE + TILE_SIZE / 2;
      if (Math.hypot(x - this.pos.x, y - this.pos.y) <= MERCHANT_RANGE) near.add(spot.merchant.id);
    }
    for (const id of near) if (!this.insideMerchants.has(id)) this.ctx.onMerchantEnter?.(id);
    this.insideMerchants = near;
  }

  /** Surların içine yeni girildiğinde kayıt noktasını tetikler. */
  private checkCityEntry(): void {
    const city = cityAt(this.ctx.map.locations, Math.floor(this.pos.x / TILE_SIZE), Math.floor(this.pos.y / TILE_SIZE));
    const entered = this.cityTracker.update(city);
    if (entered) this.ctx.onCityEnter?.(entered);
  }

  /** Sarı işaretlerin görünürlüğünü günceller, yanına gelince görev sahnesini başlatır. */
  private checkMarkers(): void {
    const active = this.ctx.quests.activeMarkers();
    for (const m of MAIN_QUEST_MARKERS) {
      this.markerSprites.get(m.id)?.setVisible(this.ctx.quests.isActive(m.chapter));
    }
    const near = new Set(markersInRange(active, this.pos.x, this.pos.y, MARKER_TRIGGER_RANGE).map((m) => m.id));
    for (const id of near) {
      if (this.insideMarkers.has(id)) continue;
      const marker = active.find((m) => m.id === id)!;
      this.ctx.onMarkerEnter(marker);
    }
    this.insideMarkers = near;
  }
}
