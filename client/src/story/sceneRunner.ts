import type { StoryLine, StoryScene } from './types';

/** Bir sahnenin hangi satırda olduğunu tutar. Arayüzden bağımsızdır. */
export class SceneRunner {
  private index = 0;
  private skipped = false;

  constructor(readonly scene: StoryScene) {
    if (scene.lines.length === 0) throw new Error(`Sahne boş: ${scene.id}`);
  }

  get current(): StoryLine {
    return this.scene.lines[this.index];
  }

  get position(): { line: number; total: number } {
    return { line: this.index + 1, total: this.scene.lines.length };
  }

  get isLastLine(): boolean {
    return this.index === this.scene.lines.length - 1;
  }

  get isDone(): boolean {
    return this.skipped || this.index >= this.scene.lines.length;
  }

  /** Sonraki satıra geçer; son satırdan sonra sahne biter. */
  next(): void {
    if (!this.isDone) this.index++;
  }

  /** Sahneyi hemen bitirir. */
  skip(): void {
    this.skipped = true;
  }
}
