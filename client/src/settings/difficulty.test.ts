import { describe, expect, it } from 'vitest';
import { enemyFighters } from '../enemies/catalog';
import { normalizeSave, buildSave } from '../save/saveData';
import { moralBonusText, effectsFor } from '../morality/morality';
import { moralGaugeHtml } from '../ui/statusBar';
import { DIFFICULTY_PROFILES, difficulty, isDifficulty, scaleEnemies } from './difficulty';

const player = { name: 'Doruk', level: 5, hp: 200, armor: 0 } as Parameters<typeof enemyFighters>[2];

describe('oyun seviyesi (Faz 2)', () => {
  it('rakibin saldırısı yalnızca Kolay seviyede görünür', () => {
    expect(DIFFICULTY_PROFILES.easy.showEnemyAttack).toBe(true);
    expect(DIFFICULTY_PROFILES.normal.showEnemyAttack).toBe(false);
    expect(DIFFICULTY_PROFILES.hard.showEnemyAttack).toBe(false);
  });

  it('ganimet, para ve rakipler: Kolay rahat, Normal olağan, Zor zorlayıcı', () => {
    const { easy, normal, hard } = DIFFICULTY_PROFILES;
    for (const k of ['dropRate', 'battleMoney', 'questMoney'] as const) {
      expect(easy[k]).toBeGreaterThan(normal[k]);
      expect(normal[k]).toBe(1);
      expect(hard[k]).toBeLessThan(normal[k]);
    }
    for (const k of ['enemyHp', 'enemyPower', 'enemySkill'] as const) {
      expect(easy[k]).toBeLessThan(normal[k]);
      expect(hard[k]).toBeGreaterThan(normal[k]);
    }
  });

  it('rakip ayarlanır, oyuncu dokunulmaz', () => {
    const base = enemyFighters('fire', 2, player);
    const hard = scaleEnemies(base, DIFFICULTY_PROFILES.hard);
    expect(hard[0]).toBe(base[0]); // insan oyuncu aynen
    expect(hard[1].maxHp).toBe(Math.round(base[1].maxHp! * 1.25));
    expect(hard[1].basePower).toBeCloseTo((base[1].basePower ?? 100) * 1.2);
    expect(hard[1].ai!.skill).toBeCloseTo(Math.min(1, base[1].ai!.skill! + 0.12));
    expect(hard[1].ai!.elements).toEqual(base[1].ai!.elements);
    const normal = scaleEnemies(base, DIFFICULTY_PROFILES.normal);
    expect(normal[1].maxHp).toBe(base[1].maxHp);
    expect(normal[1].ai!.skill).toBe(base[1].ai!.skill);
  });

  it('oyuncunun takımındaki bot (Elysia) güçlenmez; becerisi olmayan rakip genel beceriden ayarlanır', () => {
    const fighters = [
      { name: 'Sen', team: 0 as const, control: 'human' as const },
      { name: 'Elysia', team: 0 as const, control: 'bot' as const, maxHp: 300, persona: 'elysia' as const },
      { name: 'Boss', team: 1 as const, control: 'bot' as const, maxHp: 500 },
    ];
    const out = scaleEnemies(fighters, DIFFICULTY_PROFILES.easy, 1, 0.5);
    expect(out[1]).toBe(fighters[1]);
    expect(out[2].maxHp).toBe(400);
    expect(out[2].ai!.skill).toBeCloseTo(0.35);
  });

  it('beceri 0-1 dışına taşmaz', () => {
    const f = [{ name: 'B', team: 1 as const, control: 'bot' as const, ai: { skill: 0.95 } }];
    expect(scaleEnemies(f, DIFFICULTY_PROFILES.hard)[0].ai!.skill).toBe(1);
    const g = [{ name: 'B', team: 1 as const, control: 'bot' as const, ai: { skill: 0.05 } }];
    expect(scaleEnemies(g, DIFFICULTY_PROFILES.easy)[0].ai!.skill).toBe(0);
  });

  it('seviye ayarı değişince dinleyenlere haber verir', () => {
    const seen: string[] = [];
    difficulty.onChange((d) => seen.push(d));
    difficulty.set('hard');
    difficulty.set('hard'); // aynı değer: haber yok
    difficulty.set('normal');
    expect(seen).toEqual(['hard', 'normal']);
    expect(difficulty.profile).toBe(DIFFICULTY_PROFILES.normal);
  });

  it('kayıtta saklanır; eski kayıt ve bozuk değer Normal olur', () => {
    const save = buildSave('Doruk', [1], null, {
      economy: { wallet: { kor: 0, ciy: 0, tunc: 0, tuy: 0 }, xp: 0, items: {}, equipped: {} },
      quests: {},
      collected: [],
      skills: [],
      wands: { wands: {}, wandEquipped: null },
      choices: {},
      difficulty: 'easy',
    });
    expect(save.difficulty).toBe('easy');
    expect(normalizeSave(save).difficulty).toBe('easy');
    expect(normalizeSave({ playerName: 'Eski', completedChapters: [] }).difficulty).toBe('normal');
    expect(normalizeSave({ playerName: 'Eski', completedChapters: [], difficulty: 'cok-zor' as never }).difficulty).toBe('normal');
    expect([isDifficulty('easy'), isDifficulty('x'), isDifficulty(null)]).toEqual([true, false, false]);
  });
});

describe('Kara ↔ Ak ibresi (Faz 2)', () => {
  it('ibre puana göre konumlanır: tam kara solda, ortada denge, tam ak sağda', () => {
    const left = (html: string): number => Number(/left:([\d.]+)%/.exec(html)![1]);
    expect(left(moralGaugeHtml(-1, 'Kara Büyücü III'))).toBe(0);
    expect(left(moralGaugeHtml(0, 'Dengede'))).toBe(50);
    expect(left(moralGaugeHtml(1, 'Ak Büyücü III'))).toBe(100);
    expect(left(moralGaugeHtml(3, 'x'))).toBe(100); // sınır dışı kırpılır
  });

  it('bonus yazısı ibreye göre', () => {
    expect(moralBonusText(effectsFor(0))).toBe('İbre ortada: bonus yok');
    expect(moralBonusText(effectsFor(100))).toBe('Görev ödülü +%50 · Tüccarda %25 indirim');
    expect(moralBonusText(effectsFor(-100))).toBe('Ganimet şansı +%50 · Satış +%15');
    expect(moralGaugeHtml(0.5, 'Ak Büyücü II', 'Görev ödülü +%25')).toContain('Görev ödülü +%25');
  });
});
