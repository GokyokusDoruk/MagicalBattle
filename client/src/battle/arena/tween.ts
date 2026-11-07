export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOut = (t: number): number => {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
};

interface Task {
  elapsed: number;
  duration: number;
  fn: (t: number) => void;
  resolve: () => void;
}

/**
 * Küçük zamanlayıcı: `add` bir süre boyunca 0→1 arası ilerleyen bir işlev çalıştırır ve bitince çözülen
 * bir söz döndürür. Zaman, oyun döngüsünden `update(dt)` ile verilir (kare hızından bağımsız çalışır).
 */
export class Tweens {
  private tasks: Task[] = [];

  /** `fn` hemen 0 ile, sonra her karede ilerledikçe, bitişte tam 1 ile bir kez çağrılır. */
  add(durationSec: number, fn: (t: number) => void): Promise<void> {
    return new Promise((resolve) => {
      const task: Task = { elapsed: 0, duration: Math.max(1e-6, durationSec), fn, resolve };
      fn(0);
      this.tasks.push(task);
    });
  }

  /** Belirli bir süre bekler. */
  wait(durationSec: number): Promise<void> {
    return this.add(durationSec, () => {});
  }

  update(dt: number): void {
    for (const task of [...this.tasks]) {
      task.elapsed += dt;
      const t = clamp01(task.elapsed / task.duration);
      task.fn(t);
      if (t >= 1) {
        this.tasks = this.tasks.filter((x) => x !== task);
        task.resolve();
      }
    }
  }

  get activeCount(): number {
    return this.tasks.length;
  }

  /** Bekleyen her şeyi hemen bitirir (son kareyi uygulayıp). Sahne kapanırken çağrılır. */
  finishAll(): void {
    for (const task of [...this.tasks]) {
      task.fn(1);
      task.resolve();
    }
    this.tasks = [];
  }
}
