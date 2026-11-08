import { describe, expect, it } from 'vitest';
import { getItem } from '../economy/items';
import { MERCHANTS } from '../economy/merchants';
import { cityAt, locationAt } from '../save/cityEntry';
import { generateMap, reachableSet, tileAt } from './generateMap';
import { LOCATIONS, OPEN_HALF, getLocation } from './locations';
import { merchantSpots } from './merchantSpots';
import { PICKUP_SPOTS, generatePickups } from './pickups';
import { Tile, isBlockedTile } from './tiles';

const map = generateMap();

describe('toplanabilir eşyalar', () => {
  it('beklenen sayıda ot ve kristal üretilir, kimlikler benzersiz', () => {
    const herbs = PICKUP_SPOTS.filter((p) => p.itemId === 'sifali-ot');
    const crystals = PICKUP_SPOTS.filter((p) => p.itemId === 'kristal-parcasi');
    expect(herbs).toHaveLength(28);
    expect(crystals).toHaveLength(12);
    expect(new Set(PICKUP_SPOTS.map((p) => p.id)).size).toBe(PICKUP_SPOTS.length);
  });

  it('görevler için yeterince eşya var (toplam ihtiyaçtan fazla)', () => {
    expect(PICKUP_SPOTS.filter((p) => p.itemId === 'sifali-ot').length).toBeGreaterThanOrEqual(5 + 8);
    expect(PICKUP_SPOTS.filter((p) => p.itemId === 'kristal-parcasi').length).toBeGreaterThanOrEqual(3);
  });

  it('hepsi bilinen eşya; otlar çimende, kristaller kumsalda', () => {
    for (const p of PICKUP_SPOTS) {
      expect(getItem(p.itemId), p.id).toBeDefined();
      expect(tileAt(map, p.tileX, p.tileY), p.id).toBe(p.itemId === 'sifali-ot' ? Tile.Grass : Tile.Sand);
    }
  });

  it('hepsine başlangıçtan yürünür, hiçbiri surların içinde ya da yürünemez karoda değil', () => {
    const reachable = reachableSet(map, map.spawn);
    for (const p of PICKUP_SPOTS) {
      expect(reachable.has(p.tileY * map.width + p.tileX), p.id).toBe(true);
      expect(cityAt(map.locations, p.tileX, p.tileY), p.id).toBeNull();
      expect(isBlockedTile(tileAt(map, p.tileX, p.tileY)), p.id).toBe(false);
    }
  });

  it('birbirinden, başlangıçtan ve konumlardan uzakta', () => {
    for (let i = 0; i < PICKUP_SPOTS.length; i++) {
      const a = PICKUP_SPOTS[i];
      expect(Math.hypot(a.tileX - map.spawn.x, a.tileY - map.spawn.y)).toBeGreaterThanOrEqual(7);
      for (const l of LOCATIONS) expect(Math.hypot(a.tileX - l.x, a.tileY - l.y), `${a.id}/${l.id}`).toBeGreaterThan(7);
      for (let j = i + 1; j < PICKUP_SPOTS.length; j++) {
        const b = PICKUP_SPOTS[j];
        expect(Math.hypot(a.tileX - b.tileX, a.tileY - b.tileY)).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('aynı tohumla aynı yerler, farklı tohumla farklı yerler', () => {
    expect(generatePickups(map, 99)).toEqual(PICKUP_SPOTS);
    expect(generatePickups(map, 100)).not.toEqual(PICKUP_SPOTS);
  });
});

describe('tüccar yerleri', () => {
  it('her tüccar kendi köyünün alanında, yürünebilir karoda', () => {
    const spots = merchantSpots(map);
    expect(spots).toHaveLength(MERCHANTS.length);
    for (const s of spots) {
      const loc = getLocation(s.merchant.locationId);
      expect(loc.kind).toBe('village');
      expect(Math.abs(s.tileX - loc.x)).toBeLessThanOrEqual(OPEN_HALF);
      expect(Math.abs(s.tileY - loc.y)).toBeLessThanOrEqual(OPEN_HALF);
      expect(isBlockedTile(tileAt(map, s.tileX, s.tileY)), s.merchant.id).toBe(false);
      expect(locationAt(map.locations, s.tileX, s.tileY)).toBe(loc.id);
    }
  });

  it('başlangıçtan her tüccara yürünür', () => {
    const reachable = reachableSet(map, map.spawn);
    for (const s of merchantSpots(map)) expect(reachable.has(s.tileY * map.width + s.tileX), s.merchant.id).toBe(true);
  });

  it('tüccarlar köy merkezindeki yolu kapatmaz (merkezden uzakta)', () => {
    for (const s of merchantSpots(map)) {
      const loc = getLocation(s.merchant.locationId);
      expect(Math.hypot(s.tileX - loc.x, s.tileY - loc.y)).toBeGreaterThan(2);
    }
  });
});

describe('locationAt', () => {
  it('şehirde surların içini, köyde köy alanını konum sayar; dışarısı null', () => {
    const ignis = getLocation('ignis');
    const ash = getLocation('ash');
    expect(locationAt(LOCATIONS, ignis.x, ignis.y)).toBe('ignis');
    expect(locationAt(LOCATIONS, ignis.x + 6, ignis.y)).toBeNull(); // duvar karosu
    expect(locationAt(LOCATIONS, ash.x, ash.y)).toBe('ash');
    expect(locationAt(LOCATIONS, ash.x + OPEN_HALF, ash.y)).toBe('ash');
    expect(locationAt(LOCATIONS, ash.x + OPEN_HALF + 4, ash.y)).toBeNull();
    expect(locationAt(LOCATIONS, 1, 1)).toBeNull();
  });

  it('şehir için cityAt ile tutarlı (kayıt noktası yalnızca şehir)', () => {
    for (const l of LOCATIONS) {
      expect(cityAt(LOCATIONS, l.x, l.y)).toBe(l.kind === 'city' ? l.id : null);
    }
  });
});
