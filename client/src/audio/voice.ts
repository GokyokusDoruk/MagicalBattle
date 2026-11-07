/** Tarayıcının ses listesinden Türkçe bir ses seçer. Yerel (çevrimdışı) olanı tercih eder. */
export function pickTurkishVoice(voices: readonly { lang: string; localService: boolean }[]): number {
  const turkish = voices
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v.lang.toLowerCase().replace('_', '-').startsWith('tr'));
  if (turkish.length === 0) return -1;
  return (turkish.find(({ v }) => v.localService) ?? turkish[0]).i;
}

export interface VoiceStyle {
  rate: number;
  pitch: number;
}

const STYLES: Record<string, VoiceStyle> = {
  Anlatıcı: { rate: 0.95, pitch: 1.0 },
  Elysia: { rate: 1.05, pitch: 1.35 },
  Malakor: { rate: 0.85, pitch: 0.55 },
  Vael: { rate: 0.95, pitch: 0.7 },
  Kaelen: { rate: 0.8, pitch: 0.6 },
  Morwenna: { rate: 0.95, pitch: 1.25 },
  Morga: { rate: 0.9, pitch: 0.9 },
};

const DEFAULT_STYLE: VoiceStyle = { rate: 1.0, pitch: 1.0 };

/** Konuşana göre hız ve ses inceliği; tek bir Türkçe sesle farklı karakterler duyulsun diye. */
export function voiceStyle(speaker: string): VoiceStyle {
  return STYLES[speaker] ?? DEFAULT_STYLE;
}
