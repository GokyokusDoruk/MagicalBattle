import { describe, expect, it } from 'vitest';
import { generateMap, tileAt } from '../world/generateMap';
import { Tile } from '../world/tiles';
import { mulberry32 } from '../world/rng';
import { ELEMENTS } from '../battle/damage/elements';
import { EncounterGuard, ENCOUNTER_CHANCE, GRACE_MS, zoneElementAt, zoneEncounter } from './zones';

const map = generateMap();
const all: { x: number; y: number }[] = [];
for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) all.push({ x, y });

describe('bölge elementleri: yalnızca çalılıkta karşılaşma', () => {
  it('çalılık dışındaki her karo güvenlidir (çimen, kumsal, yol, su, orman, sur)', () => {
    for (const { x, y } of all) {
      if (tileAt(map, x, y) !== Tile.Thicket) expect(zoneElementAt(map, x, y), `${x},${y}`).toBeNull();
    }
  });

  it('şehir ve köy alanları güvenlidir; çalılıkta element vardır', () => {
    for (const l of map.locations) expect(zoneElementAt(map, l.x, l.y)).toBeNull();
    const thickets = all.filter((p) => tileAt(map, p.x, p.y) === Tile.Thicket);
    expect(thickets.length).toBeGreaterThan(200);
    const withEl = thickets.filter((p) => zoneElementAt(map, p.x, p.y) !== null);
    expect(withEl.length).toBeGreaterThan(thickets.length * 0.9);
  });

  it('dört elementin çalılığı da haritada bulunur (en yakın şehrin elementi)', () => {
    const seen = new Set(all.map((p) => zoneElementAt(map, p.x, p.y)).filter(Boolean));
    expect([...seen].sort()).toEqual([...ELEMENTS].sort());
  });

  it('çalılık şehrin yanındaysa şehrin elementidir', () => {
    const ignis = map.locations.find((l) => l.id === 'ignis')!;
    const near = all.filter((p) => Math.hypot(p.x - ignis.x, p.y - ignis.y) < 12 && zoneElementAt(map, p.x, p.y) !== null);
    for (const p of near) expect(zoneElementAt(map, p.x, p.y)).toBe('fire');
  });

  it('karşılaşma düşmanı çalılığın elementinde ve geçerli kademededir; güvenli karoda null', () => {
    const p = all.find((q) => zoneElementAt(map, q.x, q.y) !== null)!;
    const e = zoneEncounter(map, p.x, p.y)!;
    expect(e.element).toBe(zoneElementAt(map, p.x, p.y));
    expect([1, 2, 3, 4]).toContain(e.tier);
    expect(zoneEncounter(map, map.locations[0].x, map.locations[0].y)).toBeNull();
  });
});

describe('EncounterGuard', () => {
  it('uzun vadede yaklaşık %10, korumada hiç', () => {
    let t = 0;
    const g = new EncounterGuard(() => t);
    const rand = mulberry32(1);
    let hits = 0;
    for (let i = 0; i < 20000; i++) if (g.roll(rand)) hits++;
    expect(hits / 20000).toBeCloseTo(ENCOUNTER_CHANCE, 1);
    g.startGrace();
    for (let i = 0; i < 1000; i++) expect(g.roll(() => 0)).toBe(false);
    t = GRACE_MS - 1;
    expect(g.inGrace).toBe(true);
    t = GRACE_MS;
    expect(g.inGrace).toBe(false);
    expect(g.roll(() => 0)).toBe(true);
  });
});
