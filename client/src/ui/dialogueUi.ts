import type { Narrator } from '../audio/narrator';
import { DialogueRunner, type DialogueContext, type DialogueTree } from '../dialogue/engine';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Diyalog ekranı: altta konuşan ve metin, seçim düğümlerinde seçenek düğmeleri. Satırlar dokunma / Boşluk / Enter
 * ile ilerler; seçimler atlanamaz (Esc ya da dışarı tıklama seçimi geçmez). Bittiğinde `run()` çözülür.
 */
export class DialogueUi {
  readonly element: HTMLDivElement;
  private runner: DialogueRunner | null = null;
  private resolve: (() => void) | null = null;

  constructor(private readonly narrator: Narrator) {
    this.element = document.createElement('div');
    this.element.className = 'fixed inset-0 z-[62] hidden flex-col justify-end bg-black/60 select-none';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-label', 'Diyalog');
    this.element.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  get isOpen(): boolean {
    return this.runner !== null;
  }

  /** Diyaloğu oynatır; bitince çözülür. Zaten bir diyalog açıksa hemen çözülür. */
  run(tree: DialogueTree, ctx: DialogueContext): Promise<void> {
    if (this.runner) return Promise.resolve();
    this.runner = new DialogueRunner(tree, ctx);
    this.element.classList.remove('hidden');
    this.element.classList.add('flex');
    this.render();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  private render(): void {
    const runner = this.runner;
    if (!runner) return;
    const node = runner.current;
    if (!node) return this.finish();

    if (node.type === 'line') {
      this.element.innerHTML = `
        <div class="border-t-2 border-amber-300/60 bg-slate-950/95 p-4 sm:p-6 mobile:pb-[calc(var(--sab)+1rem)] mobile:pl-[calc(var(--sal)+1rem)] mobile:pr-[calc(var(--sar)+1rem)]" data-panel>
          <span class="mb-2 inline-block rounded bg-amber-300/90 px-3 py-0.5 text-sm font-bold text-slate-900" data-speaker>${esc(node.speaker)}</span>
          <p class="min-h-[4rem] text-lg leading-relaxed text-amber-50 sm:text-xl" data-text aria-live="polite">${esc(node.text)}</p>
          <div class="mt-2 text-right text-sm text-amber-200"><span class="animate-pulse">Devam ▶</span></div>
        </div>`;
      this.narrator.speak(node.speaker, node.text);
      return;
    }

    const options = runner.availableOptions();
    this.element.innerHTML = `
      <div class="border-t-2 border-amber-300/60 bg-slate-950/95 p-4 sm:p-6 mobile:pb-[calc(var(--sab)+1rem)] mobile:pl-[calc(var(--sal)+1rem)] mobile:pr-[calc(var(--sar)+1rem)]" data-panel>
        <span class="mb-2 inline-block rounded bg-purple-300/90 px-3 py-0.5 text-sm font-bold text-slate-900">Karar</span>
        ${node.prompt ? `<p class="mb-3 text-lg font-bold text-amber-50" data-text>${esc(node.prompt)}</p>` : ''}
        <div class="flex flex-col gap-2">${options
          .map(
            (o, i) =>
              `<button type="button" data-option="${esc(o.id)}" class="rounded border border-amber-300/50 bg-slate-800 px-4 py-3 text-left text-base text-amber-50 hover:bg-slate-700">${i + 1}. ${esc(o.label)}</button>`,
          )
          .join('')}</div>
      </div>`;
  }

  private onClick(e: MouseEvent): void {
    const runner = this.runner;
    if (!runner) return;
    const option = (e.target as HTMLElement).closest<HTMLElement>('[data-option]');
    if (option) {
      this.narrator.stop();
      runner.choose(option.dataset.option ?? '');
      return this.render();
    }
    if (runner.current?.type === 'line') this.advance();
  }

  private onKey(e: KeyboardEvent): void {
    const runner = this.runner;
    if (!runner) return;
    const node = runner.current;
    if (node?.type === 'line' && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      this.advance();
    } else if (node?.type === 'choice' && /^Digit[1-9]$/.test(e.code)) {
      const option = runner.availableOptions()[Number(e.code.slice(5)) - 1];
      if (option) {
        e.preventDefault();
        this.narrator.stop();
        runner.choose(option.id);
        this.render();
      }
    }
  }

  private advance(): void {
    this.narrator.stop();
    this.runner?.advance();
    this.render();
  }

  private finish(): void {
    this.narrator.stop();
    this.runner = null;
    this.element.classList.add('hidden');
    this.element.classList.remove('flex');
    this.element.innerHTML = '';
    const done = this.resolve;
    this.resolve = null;
    done?.();
  }
}
