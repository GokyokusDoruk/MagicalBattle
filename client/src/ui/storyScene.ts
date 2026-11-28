import type { Narrator } from '../audio/narrator';
import { SceneRunner } from '../story/sceneRunner';
import type { StoryScene } from '../story/types';
import { createSceneArt } from './storyArt';

/**
 * Tam ekran hikâye sahnesi: üstte resim, altta konuşan ve altyazı.
 * Dokunma / tıklama / Boşluk / Enter ile ilerler, Esc ya da "Atla" ile biter.
 */
export class StoryPlayer {
  readonly element: HTMLDivElement;
  private runner: SceneRunner | null = null;
  private resolve: (() => void) | null = null;

  private readonly art: HTMLDivElement;
  private readonly speakerEl: HTMLSpanElement;
  private readonly textEl: HTMLParagraphElement;
  private readonly counterEl: HTMLSpanElement;
  private readonly hintEl: HTMLSpanElement;
  private readonly muteBtn: HTMLButtonElement;

  constructor(private readonly narrator: Narrator) {
    this.element = document.createElement('div');
    this.element.className = 'fixed inset-0 z-[60] hidden flex-col bg-black select-none';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-label', 'Hikâye sahnesi');
    this.element.innerHTML = `
      <div data-art class="min-h-0 flex-1 overflow-hidden [&>svg]:h-full [&>svg]:w-full"></div>
      <div data-panel class="border-t-2 border-amber-300/60 bg-slate-950/95 p-4 sm:p-6 mobile:pb-[calc(var(--sab)+1rem)] mobile:pl-[calc(var(--sal)+1rem)] mobile:pr-[calc(var(--sar)+1rem)]">
        <span data-speaker class="mb-2 inline-block rounded bg-amber-300/90 px-3 py-0.5 text-sm font-bold text-slate-900"></span>
        <p data-text aria-live="polite" class="min-h-[5rem] text-lg leading-relaxed text-amber-50 sm:text-xl mobile:landscape:min-h-[3rem] mobile:landscape:text-base"></p>
        <div class="mt-3 flex items-center justify-between gap-3 text-sm text-slate-400">
          <span data-counter></span>
          <span data-hint class="animate-pulse text-amber-200"></span>
          <span class="flex gap-2">
            <button data-mute type="button" class="rounded bg-white/10 px-3 py-1 hover:bg-white/20"></button>
            <button data-skip type="button" class="rounded bg-white/10 px-3 py-1 hover:bg-white/20">Atla</button>
          </span>
        </div>
      </div>`;

    const q = <T extends HTMLElement>(sel: string): T => this.element.querySelector<T>(sel)!;
    this.art = q('[data-art]');
    this.speakerEl = q('[data-speaker]');
    this.textEl = q('[data-text]');
    this.counterEl = q('[data-counter]');
    this.hintEl = q('[data-hint]');
    this.muteBtn = q('[data-mute]');

    this.element.addEventListener('click', () => this.advance());
    this.muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.narrator.setMuted(!this.narrator.isMuted);
      this.updateMuteLabel();
      if (this.runner && !this.runner.isDone) this.speakCurrent();
    });
    q('[data-skip]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.finish();
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  get isOpen(): boolean {
    return this.runner !== null;
  }

  /** Sahneyi oynatır; bittiğinde (ya da atlanınca) çözülür. */
  play(scene: StoryScene): Promise<void> {
    if (this.runner) return Promise.resolve();
    this.runner = new SceneRunner(scene);
    this.art.innerHTML = createSceneArt(scene.image);
    this.element.classList.remove('hidden');
    this.element.classList.add('flex');
    this.updateMuteLabel();
    this.render();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.runner) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      this.advance();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      this.finish();
    }
  }

  private advance(): void {
    if (!this.runner) return;
    this.runner.next();
    if (this.runner.isDone) this.finish();
    else this.render();
  }

  private render(): void {
    const runner = this.runner!;
    const { speaker, text } = runner.current;
    const { line, total } = runner.position;
    this.speakerEl.textContent = speaker;
    this.textEl.textContent = text;
    this.counterEl.textContent = `${line} / ${total}`;
    this.hintEl.textContent = '';
    this.speakCurrent();
  }

  private speakCurrent(): void {
    const runner = this.runner;
    if (!runner) return;
    const { speaker, text } = runner.current;
    const line = runner.position.line;
    const last = runner.isLastLine;
    this.hintEl.textContent = '';
    this.narrator.speak(speaker, text, () => {
      // Satır değiştiyse eski okumanın bitişi ipucunu yazmasın
      if (this.runner && this.runner.position.line === line) {
        this.hintEl.textContent = last ? 'Bitir ▶' : 'Devam ▶';
      }
    });
  }

  private updateMuteLabel(): void {
    this.muteBtn.textContent = this.narrator.isMuted ? '🔇 Ses kapalı' : '🔊 Ses açık';
    this.muteBtn.hidden = !this.narrator.supported;
  }

  private finish(): void {
    if (!this.runner) return;
    this.narrator.stop();
    this.runner.skip();
    this.runner = null;
    this.element.classList.add('hidden');
    this.element.classList.remove('flex');
    this.art.innerHTML = '';
    const done = this.resolve;
    this.resolve = null;
    done?.();
  }
}
