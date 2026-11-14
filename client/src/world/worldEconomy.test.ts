import { describe, expect, it } from 'vitest';
import { MERCHANTS } from '../economy/merchants';
import { cityAt, locationAt } from '../save/cityEntry';
import { generateMap, reachableSet, tileAt } from './generateMap';
import { CITY_HALF, LOCATIONS, OPEN_HALF, getLocation } from './locations';
import { merchantSpots } from './merchantSpots';
import { isBlockedTile } from './tiles';

const map = generateMap();

describe('tüccar yerleri', () => {
  it('her tüccar ve asacı kendi şehrinin surları içinde, yürünebilir karoda', () => {
    const spots = merchantSpots(map);
    expect(spots).toHaveLength(MERCHANTS.length);
    for (const s of spots) {
      const loc = getLocation(s.merchant.locationId);
      expect(loc.kind).toBe('city');
      expect(Math.abs(s.tileX - loc.x)).toBeLessThan(CITY_HALF);
      expect(Math.abs(s.tileY - loc.y)).toBeLessThan(CITY_HALF);
      expect(isBlockedTile(tileAt(map, s.tileX, s.tileY)), s.merchant.id).toBe(false);
      expect(locationAt(map.locations, s.tileX, s.tileY)).toBe(loc.id);
    }
  });

  it('başlangıçtan her tüccara yürünür', () => {
    const reachable = reachableSet(map, map.spawn);
    for (const s of merchantSpots(map)) expect(reachable.has(s.tileY * map.width + s.tileX), s.merchant.id).toBe(true);
  });

  it('tüccar ile asacı aynı karoda durmaz ve merkezi kapatmaz', () => {
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
