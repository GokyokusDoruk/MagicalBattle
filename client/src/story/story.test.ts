import { describe, expect, it } from 'vitest';
import { GateRegistry } from '../world/gates';
import { QuestTracker } from '../world/questMarkers';
import { LAST_CHAPTER, Progress } from './progress';
import { SceneRunner } from './sceneRunner';
import type { StoryScene } from './types';

const make = () => {
  const gates = new GateRegistry();
  const quests = new QuestTracker();
  return { gates, quests, progress: new Progress(gates, quests) };
};

describe('Progress', () => {
  it('başlangıçta tüm kapılar kilitli, yalnız 1. bölüm aktif', () => {
    const { gates, quests } = make();
    expect(gates.isUnlocked('ignis')).toBe(false);
    expect(quests.activeMarkers().map((m) => m.chapter)).toEqual([1]);
  });

  it('1. bölüm bitince Ignis açılır, 2. bölüm aktif olur', () => {
    const { gates, quests, progress } = make();
    expect(progress.completeChapter(1)).toBe(true);
    expect(gates.isUnlocked('ignis')).toBe(true);
    expect(quests.activeMarkers().map((m) => m.chapter)).toEqual([2]);
  });

  it('köy bölümü bitince hiçbir kapı açılmaz', () => {
    const { gates, progress } = make();
    progress.completeChapter(1);
    progress.completeChapter(2);
    for (const id of ['abyss', 'stone-heart', 'still-crystal']) expect(gates.isUnlocked(id)).toBe(false);
  });

  it('dört şehir kendi bölümleri bitince açılır', () => {
    const { gates, progress } = make();
    for (let c = 1; c <= 7; c++) progress.completeChapter(c);
    for (const id of ['ignis', 'abyss', 'stone-heart', 'still-crystal']) expect(gates.isUnlocked(id)).toBe(true);
  });

  it('aynı bölümü ikinci kez tamamlamak etkisizdir ve dinleyiciyi çağırmaz', () => {
    const { progress } = make();
    const calls: number[] = [];
    progress.onChapterCompleted((c) => calls.push(c));
    progress.completeChapter(1);
    expect(progress.completeChapter(1)).toBe(false);
    expect(calls).toEqual([1]);
  });

  it('son bölümden sonra yeni bir bölüm aktif olmaz', () => {
    const { quests, progress } = make();
    for (let c = 1; c <= LAST_CHAPTER; c++) progress.completeChapter(c);
    expect(quests.activeMarkers()).toEqual([]);
  });

  it('snapshot/restore ilerlemeyi aynen geri getirir', () => {
    const a = make();
    for (const c of [1, 2, 3]) a.progress.completeChapter(c);
    const saved = a.progress.snapshot();
    expect(saved.completedChapters).toEqual([1, 2, 3]);

    const b = make();
    b.progress.restore(saved);
    expect(b.gates.isUnlocked('ignis')).toBe(true);
    expect(b.gates.isUnlocked('abyss')).toBe(true);
    expect(b.gates.isUnlocked('stone-heart')).toBe(false);
    expect(b.quests.activeMarkers().map((m) => m.chapter)).toEqual([4]);
  });

  it('restore, önceki durumu temizler', () => {
    const { gates, quests, progress } = make();
    for (const c of [1, 2, 3, 4, 5]) progress.completeChapter(c);
    progress.restore({ completedChapters: [1] });
    expect(gates.isUnlocked('abyss')).toBe(false);
    expect(quests.activeMarkers().map((m) => m.chapter)).toEqual([2]);
  });
});

const scene: StoryScene = {
  id: 't',
  image: 'ignis',
  lines: [
    { speaker: 'A', text: 'bir' },
    { speaker: 'B', text: 'iki' },
  ],
};

describe('SceneRunner', () => {
  it('satırları sırayla verir ve son satırdan sonra biter', () => {
    const r = new SceneRunner(scene);
    expect(r.current.text).toBe('bir');
    expect(r.position).toEqual({ line: 1, total: 2 });
    expect(r.isLastLine).toBe(false);
    r.next();
    expect(r.current.text).toBe('iki');
    expect(r.isLastLine).toBe(true);
    expect(r.isDone).toBe(false);
    r.next();
    expect(r.isDone).toBe(true);
  });

  it('skip sahneyi hemen bitirir', () => {
    const r = new SceneRunner(scene);
    r.skip();
    expect(r.isDone).toBe(true);
  });

  it('boş sahneyi reddeder', () => {
    expect(() => new SceneRunner({ id: 'x', image: 'ignis', lines: [] })).toThrow();
  });
});
