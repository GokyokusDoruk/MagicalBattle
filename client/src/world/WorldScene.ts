import * as Phaser from 'phaser';
import type { Axis } from '../input/axis';
import { moveWithCollision } from './collision';
import { isLockedGateAt, type GateRegistry } from './gates';
import { tileAt, type WorldMap } from './generateMap';
import { MAIN_QUEST_MARKERS, markersInRange, type QuestTracker } from './questMarkers';
import { PLAYER_KEY, TILESET_KEY, createPlayerTexture, createTilesetTexture } from './textures';
import { TILE_SIZE, isBlockedTile } from './tiles';

const PLAYER_SPEED = 150; // piksel/saniye
const MAX_DT = 0.05; // düşük FPS'te sıçramayı önler
const HITBOX = { hw: 9, hh: 6 };
const GATE_NOTICE_RANGE = TILE_SIZE * 1.6;
const GATE_NOTICE_COOLDOWN_MS = 3000;
const MARKER_TRIGGER_RANGE = TILE_SIZE * 0.9;

/** Dünyanın dışarıyla (arayüz, durum) konuştuğu her şey. */
export interface WorldContext {
  map: WorldMap;
  getAxis: () => Axis;
  gates: GateRegistry;
  quests: QuestTracker;
  /** Ekranda kısa bildirim göster */
  notify: (message: string) => void;
  /** Her karede oyuncunun dünya konumu (piksel) */
  onFrame?: (player: { x: number; y: number }) => void;
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

  constructor(private readonly ctx: WorldContext) {
    super('world');
  }

  create(): void {
    const { map } = this.ctx;

    createTilesetTexture(this);
    createPlayerTexture(this);

    const tilemap = this.make.tilemap({ data: map.tiles, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage('zemin', TILESET_KEY, TILE_SIZE, TILE_SIZE);
    tilemap.createLayer(0, tileset!, 0, 0);

    this.createLocationLabels();
    this.createMarkerSprites();

    this.pos = { x: map.spawn.x * TILE_SIZE + TILE_SIZE / 2, y: map.spawn.y * TILE_SIZE + TILE_SIZE / 2 };
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
    this.ctx.onFrame?.({ x: this.pos.x, y: this.pos.y });
  }

  private movePlayer(delta: number): void {
    const { map, gates } = this.ctx;
    const dt = Math.min(delta / 1000, MAX_DT);
    const axis = this.ctx.getAxis();
    if (axis.x === 0 && axis.y === 0) return;

    this.pos = moveWithCollision(
      this.pos,
      { x: axis.x * PLAYER_SPEED * dt, y: axis.y * PLAYER_SPEED * dt },
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

  /** Sarı işaretlerin görünürlüğünü günceller, yanına gelince bildirim verir. */
  private checkMarkers(): void {
    const active = this.ctx.quests.activeMarkers();
    for (const m of MAIN_QUEST_MARKERS) {
      this.markerSprites.get(m.id)?.setVisible(this.ctx.quests.isActive(m.chapter));
    }
    const near = new Set(markersInRange(active, this.pos.x, this.pos.y, MARKER_TRIGGER_RANGE).map((m) => m.id));
    for (const id of near) {
      if (this.insideMarkers.has(id)) continue;
      const marker = active.find((m) => m.id === id)!;
      this.ctx.notify(`[Ana Görev] ${marker.title}`);
    }
    this.insideMarkers = near;
  }
}
