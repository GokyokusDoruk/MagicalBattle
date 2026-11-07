import { describe, expect, it } from 'vitest';
import { pickTurkishVoice, voiceStyle } from '../../audio/voice';
import { LAST_CHAPTER } from '../../story/progress';
import { ART_KEYS, createSceneArt } from '../../ui/storyArt';
import { CHAPTER_SCENES } from './scenes';

describe('hikâye verisi', () => {
  it('her bölümün sahnesi var ve satırları boş değil', () => {
    for (let c = 1; c <= LAST_CHAPTER; c++) {
      const scene = CHAPTER_SCENES[c];
      expect(scene, `bölüm ${c}`).toBeDefined();
      expect(scene.lines.length).toBeGreaterThan(0);
      for (const line of scene.lines) {
        expect(line.speaker.trim()).not.toBe('');
        expect(line.text.trim()).not.toBe('');
      }
    }
  });

  it('sahne kimlikleri benzersiz', () => {
    const ids = Object.values(CHAPTER_SCENES).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('her sahnenin resmi tanımlı', () => {
    for (const scene of Object.values(CHAPTER_SCENES)) {
      expect(ART_KEYS).toContain(scene.image);
      expect(createSceneArt(scene.image)).toContain('<svg');
    }
  });

  it('her resmin gradyan kimliği benzersiz', () => {
    const ids = ART_KEYS.map((k) => /id="(sky-[^"]+)"/.exec(createSceneArt(k))?.[1]);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ART_KEYS.length);
    for (const k of ART_KEYS) expect(createSceneArt(k)).toContain(`url(#sky-${k})`);
  });

  it('bilinmeyen resim anahtarı hata verir', () => {
    expect(() => createSceneArt('yok')).toThrow();
  });
});

describe('seslendirme', () => {
  it('Türkçe sesi seçer, yerel olanı tercih eder', () => {
    const voices = [
      { lang: 'en-US', localService: true },
      { lang: 'tr-TR', localService: false },
      { lang: 'tr_TR', localService: true },
    ];
    expect(pickTurkishVoice(voices)).toBe(2);
  });

  it('Türkçe ses yoksa -1 döner', () => {
    expect(pickTurkishVoice([{ lang: 'en-US', localService: true }])).toBe(-1);
    expect(pickTurkishVoice([])).toBe(-1);
  });

  it('karakterlere farklı ses tonu verir, bilinmeyen için varsayılan', () => {
    expect(voiceStyle('Elysia').pitch).toBeGreaterThan(voiceStyle('Malakor').pitch);
    expect(voiceStyle('Bilinmeyen')).toEqual({ rate: 1, pitch: 1 });
  });
});
