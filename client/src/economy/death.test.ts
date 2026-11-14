import { describe, expect, it } from 'vitest';
import { LOCATIONS } from '../world/locations';
import { PlayerState } from './player';
import { HEALERS, LOSS_CAP, getHealer, moneyLoss, moneyLossFraction, healerSpots, nearestHealer, respawnLines } from './death';

describe('altın kaybı', () => {
  it('oran seviyeyle artar, üst sınırı aşmaz', () => {
    expect(moneyLossFraction(1)).toBeCloseTo(0.06, 6);
    expect(moneyLossFraction(10)).toBeCloseTo(0.15, 6);
    expect(moneyLossFraction(20)).toBe(LOSS_CAP);
    expect(moneyLossFraction(30)).toBe(LOSS_CAP);
    for (let l = 2; l <= 30; l++) expect(moneyLossFraction(l)).toBeGreaterThanOrEqual(moneyLossFraction(l - 1));
  });

  it('geçersiz seviye 1. seviye sayılır', () => {
    expect(moneyLossFraction(0)).toBe(moneyLossFraction(1));
    expect(moneyLossFraction(-5)).toBe(moneyLossFraction(1));
  });

  it('kayıp eldeki altının oranıdır; aşağı yuvarlanır, altını aşmaz', () => {
    expect(moneyLoss(10, 1000)).toBe(150);
    expect(moneyLoss(1, 99)).toBe(5); // 5.94 -> 5
    expect(moneyLoss(1, 10)).toBe(0); // 0.6 -> 0
    expect(moneyLoss(30, 3)).toBe(0);
  });

  it('altın yoksa ya da geçersizse kayıp 0', () => {
    expect(moneyLoss(5, 0)).toBe(0);
    expect(moneyLoss(5, -10)).toBe(0);
    expect(moneyLoss(5, NaN)).toBe(0);
  });

  it('yüksek seviye aynı altınla daha çok kaybeder', () => {
    expect(moneyLoss(20, 1000)).toBeGreaterThan(moneyLoss(2, 1000));
  });

  it('yalnız altın gider: XP, seviye, eşya ve ekipman korunur', () => {
    const p = new PlayerState();
    p.addMoney('kor', 1000);
    p.addXp(500);
    p.addItem('eq-robe-earth-1');
    p.equip('eq-robe-earth-1');
    const level = p.level;
    p.spendMoney('kor', moneyLoss(level, p.balance('kor')));
    expect(p.balance('kor')).toBe(1000 - moneyLoss(level, 1000));
    expect(p.xp).toBe(500);
    expect(p.level).toBe(level);
    expect(p.isEquipped('eq-robe-earth-1')).toBe(true);
  });
});

describe('şifacılar', () => {
  it('her köyde bir şifacı var', () => {
    expect(HEALERS.map((h) => h.locationId).sort()).toEqual(LOCATIONS.filter((l) => l.kind === 'village').map((l) => l.id).sort());
    expect(new Set(HEALERS.map((h) => h.id)).size).toBe(HEALERS.length);
    for (const h of HEALERS) {
      expect(LOCATIONS.find((l) => l.id === h.locationId)?.kind).toBe('village');
      expect(h.line.length).toBeGreaterThan(0);
      expect(getHealer(h.id)).toBe(h);
    }
    expect(getHealer('yok')).toBeUndefined();
  });

  it('ayılma noktası köy merkezidir', () => {
    for (const s of healerSpots()) {
      expect(s.tileX).toBe(s.location.x);
      expect(s.tileY).toBe(s.location.y);
    }
  });

  it('en yakın şifacı: her köyün kendi merkezinde kendisi', () => {
    for (const s of healerSpots()) expect(nearestHealer(s.tileX, s.tileY)?.healer.id).toBe(s.healer.id);
  });

  it('şehir önünden ölünce en yakın köy seçilir', () => {
    // Ignis (64,60) Ash (78,38)'e Bataklık (18,60)'tan çok daha yakındır
    expect(nearestHealer(64, 60)?.location.id).not.toBe('marsh');
    // Stone Heart (16,30): Vine (36,14) 20,16 uzak; Bataklık (18,60) 2,30 uzak => Vine
    expect(nearestHealer(16, 30)?.location.id).toBe('vine');
    // Still Crystal (36,80): Bataklık (18,60)
    expect(nearestHealer(36, 80)?.location.id).toBe('marsh');
    // Cadı Sis Geçidi (70,82): Ash (78,38) 44 uzak, Bataklık (18,60) 52+22: Ash/Bataklık arası -> yine bir köy
    expect(nearestHealer(70, 82)).not.toBeNull();
  });

  it('şifacı yoksa null', () => {
    expect(nearestHealer(0, 0, [])).toBeNull();
  });

  it('ayılma satırları köyü, kaybı ve şifacının sözünü söyler', () => {
    const spot = healerSpots()[0];
    const lines = respawnLines(spot, 150, 10);
    expect(lines).toHaveLength(3);
    expect(lines[0].text).toContain(spot.location.name);
    expect(lines[1].text).toContain('150');
    expect(lines[1].text).toContain('%15');
    expect(lines[2].speaker).toBe(spot.healer.name);
    expect(respawnLines(spot, 0, 1)[1].text).toContain('kaybedecek paran yoktu');
  });
});
