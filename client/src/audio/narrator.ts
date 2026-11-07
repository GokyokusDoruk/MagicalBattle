import { pickTurkishVoice, voiceStyle } from './voice';

/** Tarayıcının sesli okuma özelliği (SpeechSynthesis). Desteklenmiyorsa sessizce atlar. */
export class Narrator {
  private muted = false;
  private voice: SpeechSynthesisVoice | null = null;
  readonly supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  constructor() {
    if (!this.supported) return;
    this.refreshVoice();
    // Sesler Chrome'da geç yüklenir
    window.speechSynthesis.addEventListener('voiceschanged', () => this.refreshVoice());
  }

  private refreshVoice(): void {
    const voices = window.speechSynthesis.getVoices();
    const index = pickTurkishVoice(voices);
    this.voice = index >= 0 ? voices[index] : null;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stop();
  }

  /** Satırı okur. Okuma bitince (ya da hiç okunamıyorsa hemen) `onEnd` çağrılır. */
  speak(speaker: string, text: string, onEnd?: () => void): void {
    this.stop();
    if (!this.supported || this.muted) {
      onEnd?.();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const style = voiceStyle(speaker);
    utterance.lang = 'tr-TR';
    if (this.voice) utterance.voice = this.voice;
    utterance.rate = style.rate;
    utterance.pitch = style.pitch;
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (this.supported) window.speechSynthesis.cancel();
  }
}
