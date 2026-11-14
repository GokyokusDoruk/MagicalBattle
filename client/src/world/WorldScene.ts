import * as Phaser from 'phaser';
import type { Axis } from '../input/axis';
import { moveWithCollision } from './collision';
import { isLockedGateAt, type GateRegistry } from './gates';
import { tileAt, type WorldMap } from './generateMap';
import { CityEntryTracker, cityAt, locationAt } from '../save/cityEntry';
import type { MerchantSpot } from './merchantSpots';
import type { PickupSpot } from './pickups';
import { MAIN_QUEST_MARKERS, markersInRange, type MainQuestMarker, type QuestTracker } from './questMarkers';
import { CRYSTAL_KEY, HERB_KEY, PILE_KEY, PLAYER_KEY, STALL_KEY, TILESET_KEY, createPlayerTexture, createTilesetTexture, createWorldItemTextures } from './textures';
import { TILE_SIZE, isBlockedTile } from './tiles';

const PLAYER_SPEED = 150; // piksel/saniye
const MAX_DT = 0.05; // düşük FPS'te sıçramayı önler
const HITBOX = { hw: 9, hh: 6 };
const GATE_NOTICE_RANGE = TILE_SIZE * 1.6;
const GATE_NOTICE_COOLDOWN_MS = 3000;
const MARKER_TRIGGER_RANGE = TILE_SIZE * 0.9;
const MERCHANT_RANGE = TILE_SIZE * 1.6;
const PICKUP_RANGE = TILE_SIZE * 0.85;
const PILE_RANGE = TILE_SIZE * 0.9;

/** Dünyanın dışarıyla (arayüz, durum) konuştuğu her şey. */
export interface WorldContext {
  map: WorldMap;
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
  /** Dünyada toplanabilir eşyalar (toplananlar `isCollected` ile elenir) */
  pickups?: readonly PickupSpot[];
  isCollected?: (id: string) => boolean;
  onPickup?: (spot: PickupSpot) => void;
  /** Oyuncu bir konumun (şehir, köy, arena) alanına yeni girdi */
  onLocationEnter?: (locationId: string) => void;
  /** Oyuncunun bulunduğu konum değişti (`null` = açık dünya): şehre girme, şehirden çıkma ve konumlar arası geçiş */
  onLocationChange?: (from: string | null, to: string | null) => void;
  /** Yerdeki eşya yığınları (şehirden çıkarken bırakılanlar); yığına yaklaşınca `onPileEnter` çağrılır */
  groundPiles?: () => readonly { id: string; tileX: number; tileY: number }[];
  onPileEnter?: (pileId: string) => void;
  /** Oyuncuyu bir dünya konumuna (piksel) ışınlar; kayıt yükleme ve geliştirme denemeleri için. Boşsa null. */
  takeTeleport?: () => { x: number; y: number } | null;
}

/** Açık dünya: harita, oyuncu hareketi, çarpışma, kamera, kapılar ve ana görev işaretleri. */
export class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private pos = { x: 0, y: 0 };
  private markerSprites = new Map<string, Phaser.GameObjects.Text>();
  private insideMarkers = new Set<string>();
  private lastGateNotice = new Map<string, number>();
  private cityTracker = new CityEntryTracker();
  private locationTracker = new CityEntryTracker();
  private pickupSprites = new Map<string, Phaser.GameObjects.Image>();
  private insideMerchants = new Set<string>();
  private currentLocation: string | null = null;
  private pileSprites = new Map<string, Phaser.GameObjects.Image>();
  private insidePiles = new Set<string>();

  constructor(private readonly ctx: WorldContext) {
    super('world');
  }

  create(): void {
    const { map } = this.ctx;

    createTilesetTexture(this);
    createPlayerTexture(this);
    createWorldItemTextures(this);

    const tilemap = this.make.tilemap({ data: map.tiles, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage('zemin', TILESET_KEY, TILE_SIZE, TILE_SIZE);
    tilemap.createLayer(0, tileset!, 0, 0);

    this.createLocationLabels();
    this.createMarkerSprites();
    this.createMerchants();
    this.createPickups();

    const start = this.ctx.startTile ?? map.spawn;
    this.pos = { x: start.x * TILE_SIZE + TILE_SIZE / 2, y: start.y * TILE_SIZE + TILE_SIZE / 2 };
    // Kayıttan şehrin içinde başlanıyorsa bu yeni bir "giriş" sayılmaz (tekrar kayıt tetiklenmesin)
    this.cityTracker = new CityEntryTracker(cityAt(map.locations, start.x, start.y));
    this.locationTracker = new CityEntryTracker(locationAt(map.locations, start.x, start.y));
    this.currentLocation = locationAt(map.locations, start.x, start.y);
    this.player = this.add.image(this.pos.x, this.pos.y, PLAYER_KEY).setOrigin(0.5, 0.8).setDepth(10);

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
    for (const m of MAIN_QUEST_MARKERS) {
      const sprite = this.add
        .text(m.px, m.py - TILE_SIZE * 0.5, '!', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '30px',
          fontStyle: 'bold',
          color: '#ffd23f',
          stroke: '#3a2a00',
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(8);
      this.tweens.add({ targets: sprite, y: sprite.y - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
      this.pos = { ...teleport };
      this.player.setPosition(this.pos.x, this.pos.y);
    }
    this.movePlayer(delta);
    this.checkGates(time);
    this.checkMarkers();
    this.checkCityEntry();
    this.checkLocationEntry();
    this.syncPiles();
    this.checkMerchants();
    this.checkPickups();
    this.ctx.onFrame?.({ x: this.pos.x, y: this.pos.y });
  }

  private movePlayer(delta: number): void {
    const { map, gates } = this.ctx;
    const dt = Math.min(delta / 1000, MAX_DT);
    const axis = this.ctx.getAxis();
    if (axis.x === 0 && axis.y === 0) return;
    const speed = PLAYER_SPEED * Math.max(0.1, this.ctx.getSpeedMultiplier?.() ?? 1);

    this.pos = moveWithCollision(
      this.pos,
      { x: axis.x * speed * dt, y: axis.y * speed * dt },
      HITBOX,
      TILE_SIZE,
      (tx, ty) => isBlockedTile(tileAt(map, tx, ty)) || isLockedGateAt(map.gates, gates, tx, ty),
    );
    this.player.setPosition(this.pos.x, this.pos.y);
    if (axis.x !== 0) this.player.setFlipX(axis.x < 0);
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
      this.ctx.notify(`${city.name} kapısı kilitli. Bu bölgenin ana görevini tamamla.`);
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

  /** Toplanabilir otlar ve kristaller; henüz toplanmamış olanlar hafifçe sallanır. */
  private createPickups(): void {
    for (const spot of this.ctx.pickups ?? []) {
      if (this.ctx.isCollected?.(spot.id)) continue;
      const key = spot.itemId === 'kristal-parcasi' ? CRYSTAL_KEY : HERB_KEY;
      const sprite = this.add
        .image(spot.tileX * TILE_SIZE + TILE_SIZE / 2, spot.tileY * TILE_SIZE + TILE_SIZE / 2, key)
        .setDepth(3);
      this.tweens.add({ targets: sprite, y: sprite.y - 3, duration: 900 + (spot.tileX % 5) * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.pickupSprites.set(spot.id, sprite);
    }
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

  /** Yakındaki toplanabilir eşyayı alır ve haritadan kaldırır. */
  private checkPickups(): void {
    for (const spot of this.ctx.pickups ?? []) {
      const sprite = this.pickupSprites.get(spot.id);
      if (!sprite) continue;
      const x = spot.tileX * TILE_SIZE + TILE_SIZE / 2;
      const y = spot.tileY * TILE_SIZE + TILE_SIZE / 2;
      if (Math.hypot(x - this.pos.x, y - this.pos.y) > PICKUP_RANGE) continue;
      this.pickupSprites.delete(spot.id);
      this.tweens.add({ targets: sprite, y: sprite.y - 24, alpha: 0, duration: 350, onComplete: () => sprite.destroy() });
      this.ctx.onPickup?.(spot);
    }
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
