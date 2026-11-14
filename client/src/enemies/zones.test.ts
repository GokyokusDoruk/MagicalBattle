import { describe, expect, it } from 'vitest';
import { generateMap, tileAt } from '../world/generateMap';
import { Tile } from '../world/tiles';
import { mulberry32 } from '../world/rng';
import { ELEMENTS } from '../battle/damage/elements';
import { EncounterGuard, ENCOUNTER_CHANCE, GRACE_MS, zoneElementAt, zoneEncounter } from './zones';

const map = generateMap();
const all: { x: number; y: number }[] = [];
for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) all.push({ x, y });

describe('bölge elementleri', () => {
  it('yol, duvar, su ve orman güvenlidir; kumsal sudur', () => {
    for (const { x, y } of all) {
      const t = tileAt(map, x, y);
      const z = zoneElementAt(map, x, y);
      if (t !== Tile.Grass && t !== Tile.Sand) expect(z).toBeNull();
      else if (z !== null && t === Tile.Sand) expect(z).toBe('water');
    }
  });

  it('şehir ve köy alanları güvenlidir', () => {
    for (const l of map.locations) expect(zoneElementAt(map, l.x, l.y)).toBeNull();
  });

  it('dört element de haritada bulunur ve çoğunluk yeşillik (toprak) değildir bile olsa hepsi vardır', () => {
    const seen = new Set(all.map((p) => zoneElementAt(map, p.x, p.y)).filter(Boolean));
    expect([...seen].sort()).toEqual([...ELEMENTS].sort());
  });

  it('şehrin yanındaki çimen şehrin elementidir', () => {
    const ignis = map.locations.find((l) => l.id === 'ignis')!;
    const near = all.filter((p) => Math.hypot(p.x - ignis.x, p.y - ignis.y) < 14 && zoneElementAt(map, p.x, p.y) !== null && tileAt(map, p.x, p.y) === Tile.Grass);
    expect(near.length).toBeGreaterThan(0);
    for (const p of near) expect(zoneElementAt(map, p.x, p.y)).toBe('fire');
  });

  it('karşılaşma düşmanı bölge elementinde ve geçerli kademededir', () => {
    const p = all.find((q) => zoneElementAt(map, q.x, q.y) === 'earth')!;
    const e = zoneEncounter(map, p.x, p.y)!;
    expect(e.element).toBe('earth');
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
