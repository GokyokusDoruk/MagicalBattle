import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../battle/damage/elements';
import { PlayerState } from '../economy/player';
import { BRIBE_MIN, BRIBE_MULTIPLIER, bribeCost } from './bribe';
import { TIERS, enemyStats } from './catalog';

describe('rüşvet', () => {
  it('bedel, düşmanın ganimet parasının 3 katıdır; kademeyle artar; alt sınırı vardır', () => {
    expect(BRIBE_MULTIPLIER).toBe(3);
    for (const el of ELEMENTS) {
      for (const t of TIERS) expect(bribeCost(el, t)).toBe(Math.max(BRIBE_MIN, Math.round(enemyStats(el, t).money * 3)));
      const costs = TIERS.map((t) => bribeCost(el, t));
      expect([...costs].sort((a, b) => a - b)).toEqual(costs);
    }
    expect(bribeCost('fire', 1)).toBe(42); // (6 + 2*4) * 3
    expect(bribeCost('fire', 4)).toBe(186); // (6 + 14*4) * 3
  });

  it('rüşvet yalnızca o birimden ödenir; para yetmezse ödenmez ve bakiye değişmez', () => {
    const p = new PlayerState();
    p.addMoney('kor', 100);
    const cost = bribeCost('fire', 2);
    expect(p.spendMoney('ciy', cost)).toBe(false); // başka birimden ödenemez
    expect(p.spendMoney('kor', cost)).toBe(true);
    expect(p.balance('kor')).toBe(100 - cost);
    const poor = new PlayerState();
    poor.addMoney('kor', cost - 1);
    expect(poor.spendMoney('kor', cost)).toBe(false);
    expect(poor.balance('kor')).toBe(cost - 1);
  });
});
