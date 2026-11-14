import { describe, expect, it } from 'vitest';
import { BattleEngine } from '../battle/flow/engine';
import { bossFighters } from '../boss/bosses';
import { MAX_HP } from '../battle/flow/config';
import { HP_PER_LEVEL, playerMaxHp } from './health';
import { PlayerState } from './player';
import { xpToReach } from './leveling';

describe('kalıcı can', () => {
  it('yeni oyuncu dolu canla başlar, azami can seviyeyle artar', () => {
    const p = new PlayerState();
    expect(p.maxHp).toBe(MAX_HP);
    expect(p.hp).toBe(MAX_HP);
    expect(p.isHurt).toBe(false);
    p.addXp(xpToReach(5));
    expect(p.maxHp).toBe(playerMaxHp(5));
    expect(p.hp).toBe(p.maxHp);
  });

  it('setHp 1 ile azami can arasına çeker; dolunca kayıtta null olur', () => {
    const p = new PlayerState();
    p.setHp(120);
    expect(p.hp).toBe(120);
    expect(p.snapshot().hp).toBe(120);
    p.setHp(0);
    expect(p.hp).toBe(1); // ölü sayılmaz
    p.setHp(99999);
    expect(p.hp).toBe(p.maxHp);
    expect(p.snapshot().hp).toBeNull();
  });

  it('heal gerçekten yenilenen miktarı döndürür, azami canı aşmaz', () => {
    const p = new PlayerState();
    p.setHp(250);
    expect(p.heal(30)).toBe(30);
    expect(p.heal(500)).toBe(20);
    expect(p.hp).toBe(MAX_HP);
    expect(p.heal(10)).toBe(0);
  });

  it('seviye atlayınca azami can artar, eksik can aynı kalır', () => {
    const p = new PlayerState();
    p.setHp(MAX_HP - 100); // 100 eksik
    p.addXp(xpToReach(4));
    expect(p.maxHp).toBe(MAX_HP + 3 * HP_PER_LEVEL);
    expect(p.maxHp - p.hp).toBe(100);
  });

  it('kayıttan yüklenir; bozuk değerler dolu cana döner, azami canı aşan dolu sayılır', () => {
    const p = new PlayerState();
    p.restore({ hp: 77 });
    expect(p.hp).toBe(77);
    p.restore({ hp: null });
    expect(p.hp).toBe(p.maxHp);
    p.restore({});
    expect(p.hp).toBe(p.maxHp);
    p.restore({ hp: Number.NaN });
    expect(p.hp).toBe(p.maxHp);
    p.restore({ hp: 99999 });
    expect(p.hp).toBe(p.maxHp);
    p.restore({ hp: -5 });
    expect(p.hp).toBe(1);
  });

  it('can iksiri canı yeniler ve harcanır; dolu canda ve iksir olmadan harcanmaz', () => {
    const p = new PlayerState();
    p.addItem('iksir-kucuk', 2);
    expect(p.usePotion('iksir-kucuk').ok).toBe(false); // can dolu
    expect(p.count('iksir-kucuk')).toBe(2);
    p.setHp(100);
    const r = p.usePotion('iksir-kucuk');
    expect(r).toEqual({ ok: true, healed: 60 });
    expect(p.hp).toBe(160);
    expect(p.count('iksir-kucuk')).toBe(1);
    expect(p.usePotion('iksir-orta').ok).toBe(false); // yok
    expect(p.usePotion('tas-cevheri').ok).toBe(false); // iksir değil
    p.setHp(290);
    expect(p.usePotion('iksir-kucuk')).toEqual({ ok: true, healed: 10 }); // fazlası boşa gider
    expect(p.hp).toBe(MAX_HP);
  });

  it('fullHeal canı doldurur', () => {
    const p = new PlayerState();
    p.setHp(5);
    p.fullHeal();
    expect(p.hp).toBe(p.maxHp);
  });
});

describe('savaşa mevcut canla girmek', () => {
  const stats = { name: 'T', level: 1, armor: 0 };

  it('motor başlangıç canını azami cana çeker', () => {
    const e = new BattleEngine([
      { name: 'A', team: 0, control: 'human', maxHp: 300, hp: 120 },
      { name: 'B', team: 1, control: 'bot', maxHp: 300, hp: 9999 },
    ]);
    expect(e.fighter({ team: 0, index: 0 }).hp).toBe(120);
    expect(e.fighter({ team: 1, index: 0 }).hp).toBe(300);
    const z = new BattleEngine([
      { name: 'A', team: 0, control: 'human', hp: 0 },
      { name: 'B', team: 1, control: 'bot' },
    ]);
    expect(z.fighter({ team: 0, index: 0 }).hp).toBe(1);
  });

  it('boss savaşında oyuncu mevcut canla, boss tam canla başlar', () => {
    const fighters = bossFighters(1, { ...stats, hp: 80 });
    const e = new BattleEngine(fighters);
    expect(e.fighter({ team: 0, index: 0 }).hp).toBe(80);
    const boss = e.fighter({ team: 1, index: 0 });
    expect(boss.hp).toBe(boss.maxHp);
    const full = new BattleEngine(bossFighters(1, stats));
    expect(full.fighter({ team: 0, index: 0 }).hp).toBe(playerMaxHp(1));
  });
});
