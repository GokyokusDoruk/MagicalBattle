import type { GateRegistry } from '../world/gates';
import type { WorldMap } from '../world/generateMap';
import type { QuestTracker } from '../world/questMarkers';
import { TILE_SIZE, Tile } from '../world/tiles';
import { DANGER_ZONES } from '../enemies/dangerZones';

const SCALE = 2; // karo başına piksel
const COLORS: Record<Tile, string> = {
  [Tile.Grass]: '#3f8f3f',
  [Tile.Water]: '#2f6fb5',
  [Tile.Forest]: '#1f5a2a',
  [Tile.Sand]: '#d9c38a',
  [Tile.Wall]: '#8a8a95',
  [Tile.Gate]: '#8a8a95',
  [Tile.Path]: '#a67c52',
  [Tile.Thicket]: '#687d34',
};

/** Tüm haritayı gösteren küçük harita: oyuncu (beyaz), ana görevler (sarı), kapılar (kırmızı/yeşil), tehlikeli bölgeler (kırmızı daire, ☠). */
export class Minimap {
  readonly element: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly terrain: HTMLCanvasElement;

  constructor(
    private readonly map: WorldMap,
    private readonly gates: GateRegistry,
    private readonly quests: QuestTracker,
  ) {
    const w = map.width * SCALE;
    const h = map.height * SCALE;

    this.terrain = document.createElement('canvas');
    this.terrain.width = w;
    this.terrain.height = h;
    const tctx = this.terrain.getContext('2d')!;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        tctx.fillStyle = COLORS[map.tiles[y][x]];
        tctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }

    this.element = document.createElement('canvas');
    this.element.width = w;
    this.element.height = h;
    this.element.setAttribute('aria-label', 'Minimap');
    this.element.className =
      'pointer-events-none fixed right-3 top-3 z-40 h-36 w-36 rounded-lg border-2 border-amber-200/70 opacity-90 shadow-lg';
    this.ctx = this.element.getContext('2d')!;
  }

  /** `player` dünya koordinatında (piksel). */
  update(player: { x: number; y: number }): void {
    const c = this.ctx;
    c.drawImage(this.terrain, 0, 0);

    // Tehlikeli bölgeler: kırmızı dolgulu daire ve kenar çizgisi (kafatası işareti ortada)
    for (const z of DANGER_ZONES) {
      c.beginPath();
      c.arc(z.tileX * SCALE, z.tileY * SCALE, z.radius * SCALE, 0, Math.PI * 2);
      c.fillStyle = 'rgba(220,38,38,0.38)';
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = 'rgba(254,202,202,0.9)';
      c.stroke();
      c.font = 'bold 11px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#ffffff';
      c.fillText('☠', z.tileX * SCALE, z.tileY * SCALE);
    }

    for (const gate of this.map.gates) {
      c.fillStyle = this.gates.isUnlocked(gate.cityId) ? '#4ade80' : '#ef4444';
      c.fillRect(gate.x * SCALE - 1, gate.y * SCALE - 1, SCALE + 2, SCALE + 2);
    }

    for (const m of this.quests.activeMarkers()) {
      this.dot((m.px / TILE_SIZE) * SCALE, (m.py / TILE_SIZE) * SCALE, 4, '#ffd23f');
    }

    this.dot((player.x / TILE_SIZE) * SCALE, (player.y / TILE_SIZE) * SCALE, 3, '#ffffff');
  }

  private dot(x: number, y: number, radius: number, color: string): void {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
    c.lineWidth = 1.5;
    c.strokeStyle = '#000000';
    c.stroke();
  }
}
