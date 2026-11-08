import { describe, expect, it } from 'vitest';
import { MORAL_CHOICES } from '../morality/catalog';
import { Morality } from '../morality/morality';
import { DialogueRunner, MAX_STEPS, meets, validateTree, type DialogueEffect, type DialogueTree } from './engine';
import { buildChoiceTree, chapterChoiceTrees, linesTree } from './moralDialogues';

const ctx = (score = 0, flags: string[] = []) => {
  const effects: DialogueEffect[] = [];
  const c = { score: () => score, flags: new Set(flags), onEffect: (e: DialogueEffect) => void effects.push(e) };
  return { c, effects };
};

const tree: DialogueTree = {
  id: 't',
  start: 'a',
  nodes: {
    a: { id: 'a', type: 'line', speaker: 'X', text: 'Merhaba', next: 'q' },
    q: {
      id: 'q',
      type: 'choice',
      options: [
        { id: 'hi', label: 'Selam', next: 'ok', effect: { type: 'flag', key: 'nazik' } },
        { id: 'secret', label: 'Gizli', next: 'ok', requires: { minScore: 20 } },
        { id: 'leave', label: 'Git' },
      ],
    },
    ok: { id: 'ok', type: 'line', speaker: 'X', text: 'Güzel' },
  },
};

describe('koşullar', () => {
  it('puan aralığı ve bayraklar', () => {
    const base = { score: () => 30, flags: new Set(['a']) };
    expect(meets(undefined, base)).toBe(true);
    expect(meets({ minScore: 30 }, base)).toBe(true);
    expect(meets({ minScore: 31 }, base)).toBe(false);
    expect(meets({ maxScore: 29 }, base)).toBe(false);
    expect(meets({ flag: 'a' }, base)).toBe(true);
    expect(meets({ flag: 'b' }, base)).toBe(false);
    expect(meets({ notFlag: 'a' }, base)).toBe(false);
    expect(meets({ minScore: 0, maxScore: 50, flag: 'a', notFlag: 'b' }, base)).toBe(true);
  });
});

describe('validateTree', () => {
  it('geçerli ağaçta hata yok', () => {
    expect(validateTree(tree)).toEqual([]);
  });

  it('olmayan başlangıç, kırık bağlantı, seçeneksiz seçim, tekrarlı seçenek ve yanlış anahtar yakalanır', () => {
    const bad: DialogueTree = {
      id: 'b',
      start: 'yok',
      nodes: {
        a: { id: 'a', type: 'line', speaker: '', text: '', next: 'kayip' },
        q: { id: 'q', type: 'choice', options: [] },
        r: { id: 'r', type: 'choice', options: [{ id: 'x', label: '' }, { id: 'x', label: '', next: 'olmayan' }] },
        z: { id: 'baska', type: 'line', speaker: '', text: '' },
      },
    };
    const errors = validateTree(bad).join('\n');
    expect(errors).toContain('başlangıç');
    expect(errors).toContain('kayip');
    expect(errors).toContain('seçenek yok');
    expect(errors).toContain('tekrarlı');
    expect(errors).toContain('olmayan');
    expect(errors).toContain('uyuşmuyor');
  });

  it('geçersiz ağaçla motor kurulamaz', () => {
    expect(() => new DialogueRunner({ id: 'x', start: 'a', nodes: {} }, ctx().c)).toThrow();
  });
});

describe('DialogueRunner', () => {
  it('satırlar sırayla ilerler, seçimde durur, bitince isDone', () => {
    const { c } = ctx();
    const r = new DialogueRunner(tree, c);
    expect(r.current).toMatchObject({ id: 'a' });
    r.advance();
    expect(r.current).toMatchObject({ id: 'q', type: 'choice' });
    r.advance(); // seçimde advance bir şey yapmaz
    expect(r.current).toMatchObject({ id: 'q' });
    expect(r.choose('hi')).toBe(true);
    expect(r.current).toMatchObject({ id: 'ok' });
    r.advance();
    expect(r.isDone).toBe(true);
    expect(r.current).toBeNull();
    expect(r.history).toEqual(['a', 'q', 'ok']);
  });

  it('seçeneğin etkisi seçilince uygulanır', () => {
    const { c, effects } = ctx();
    const r = new DialogueRunner(tree, c);
    r.advance();
    r.choose('hi');
    expect(effects).toEqual([{ type: 'flag', key: 'nazik' }]);
  });

  it('koşulu sağlanmayan seçenek listelenmez ve seçilemez', () => {
    const low = ctx(0);
    const r = new DialogueRunner(tree, low.c);
    r.advance();
    expect(r.availableOptions().map((o) => o.id)).toEqual(['hi', 'leave']);
    expect(r.choose('secret')).toBe(false);
    expect(r.current).toMatchObject({ id: 'q' });

    const high = ctx(40);
    const r2 = new DialogueRunner(tree, high.c);
    r2.advance();
    expect(r2.availableOptions().map((o) => o.id)).toEqual(['hi', 'secret', 'leave']);
  });

  it('sonraki düğümü olmayan seçenek diyaloğu bitirir', () => {
    const r = new DialogueRunner(tree, ctx().c);
    r.advance();
    r.choose('leave');
    expect(r.isDone).toBe(true);
  });

  it('satırda choose, seçimde değil olmayan seçenek: false', () => {
    const r = new DialogueRunner(tree, ctx().c);
    expect(r.choose('hi')).toBe(false); // henüz satırda
    r.advance();
    expect(r.choose('olmayan')).toBe(false);
  });

  it('sonsuz döngü korunur', () => {
    const loop: DialogueTree = {
      id: 'l',
      start: 'a',
      nodes: { a: { id: 'a', type: 'line', speaker: '', text: '', next: 'b' }, b: { id: 'b', type: 'line', speaker: '', text: '', next: 'a' } },
    };
    const r = new DialogueRunner(loop, ctx().c);
    expect(() => {
      for (let i = 0; i < MAX_STEPS + 5; i++) r.advance();
    }).toThrow('döngü');
  });
});

describe('ahlak seçimi ağaçları', () => {
  it('16 seçimin hepsi geçerli bir ağaç', () => {
    for (const c of MORAL_CHOICES) expect(validateTree(buildChoiceTree(c)), c.id).toEqual([]);
  });

  it('her bölümün iki ağacı var', () => {
    for (let ch = 1; ch <= 8; ch++) expect(chapterChoiceTrees(ch)).toHaveLength(2);
  });

  it('seçim: durum satırları → iki seçenek → tepki satırları → son; etki ahlakı değiştirir', () => {
    const m = new Morality();
    const choice = MORAL_CHOICES[0];
    const r = new DialogueRunner(buildChoiceTree(choice), {
      score: () => m.score,
      flags: new Set(),
      onEffect: (e) => e.type === 'moral' && m.choose(e.choiceId, e.side),
    });
    let guard = 0;
    while (r.current?.type === 'line' && guard++ < 10) r.advance();
    expect(r.current).toMatchObject({ type: 'choice' });
    expect(r.availableOptions().map((o) => o.label)).toEqual([choice.good.label, choice.bad.label]);
    r.choose('bad');
    expect(m.decided(choice.id)).toBe('bad');
    expect(m.score).toBe(-choice.bad.weight);
    expect(r.current).toMatchObject({ type: 'line', text: choice.bad.result[0].text });
    r.advance();
    expect(r.isDone).toBe(true);
  });

  it('linesTree satırları sırayla bağlar; boş liste güvenli', () => {
    const t = linesTree('f', [{ speaker: 'A', text: '1' }, { speaker: 'B', text: '2' }]);
    expect(validateTree(t)).toEqual([]);
    const r = new DialogueRunner(t, ctx().c);
    r.advance();
    expect(r.current).toMatchObject({ text: '2' });
    r.advance();
    expect(r.isDone).toBe(true);
    expect(validateTree(linesTree('e', []))).toEqual([]);
  });
});
