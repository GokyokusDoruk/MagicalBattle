import * as Phaser from 'phaser';
import type { Axis } from '../input/axis';
import { moveWithCollision } from './collision';
import { generateMap, tileAt, type WorldMap } from './generateMap';
import { PLAYER_KEY, TILESET_KEY, createPlayerTexture, createTilesetTexture } from './textures';
import { TILE_SIZE, isBlockedTile } from './tiles';

const PLAYER_SPEED = 150; // piksel/saniye
const MAX_DT = 0.05; // düşük FPS'te sıçramayı önler
const HITBOX = { hw: 9, hh: 6 };

/** Açık dünya: harita, oyuncu hareketi, çarpışma ve kamera takibi. */
export class WorldScene extends Phaser.Scene {
  private map!: WorldMap;
  private player!: Phaser.GameObjects.Image;
  private pos = { x: 0, y: 0 };

  constructor(private readonly getAxis: () => Axis) {
    super('world');
  }

  create(): void {
    this.map = generateMap();

    createTilesetTexture(this);
    createPlayerTexture(this);

    const tilemap = this.make.tilemap({
      data: this.map.tiles,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = tilemap.addTilesetImage('zemin', TILESET_KEY, TILE_SIZE, TILE_SIZE);
    tilemap.createLayer(0, tileset!, 0, 0);

    this.pos = {
      x: this.map.spawn.x * TILE_SIZE + TILE_SIZE / 2,
      y: this.map.spawn.y * TILE_SIZE + TILE_SIZE / 2,
    };
    this.player = this.add.image(this.pos.x, this.pos.y, PLAYER_KEY).setOrigin(0.5, 0.8).setDepth(10);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.map.width * TILE_SIZE, this.map.height * TILE_SIZE);
    cam.startFollow(this.player, true, 0.12, 0.12);
    this.applyZoom();
    this.scale.on('resize', () => this.applyZoom());
  }

  /** Küçük ekranda da yeterince karo görünsün diye ekrana göre yakınlaştırır. */
  private applyZoom(): void {
    const shortSide = Math.min(this.scale.width, this.scale.height);
    this.cameras.main.setZoom(Phaser.Math.Clamp(shortSide / 360, 1.25, 2.5));
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, MAX_DT);
    const axis = this.getAxis();
    if (axis.x === 0 && axis.y === 0) return;

    this.pos = moveWithCollision(
      this.pos,
      { x: axis.x * PLAYER_SPEED * dt, y: axis.y * PLAYER_SPEED * dt },
      HITBOX,
      TILE_SIZE,
      (tx, ty) => isBlockedTile(tileAt(this.map, tx, ty)),
    );
    this.player.setPosition(this.pos.x, this.pos.y);
    if (axis.x !== 0) this.player.setFlipX(axis.x < 0);
  }
}
