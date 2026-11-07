import type { Progress } from '../story/progress';
import { buildSave, type SaveData, type SavePoint } from './saveData';

export interface SaveApi {
  putSave(data: SaveData): Promise<void>;
}

export type SaveResult = 'saved' | 'failed' | 'disabled';

/**
 * Kayıt noktalarında ilerlemeyi sunucuya yazar.
 * `api` null ise (kayıtsız mod ya da kayıt yüklenemediyse) hiçbir şey yazmaz: yüklenemeyen
 * bir kaydın üzerine yeni oyun yazılıp gerçek ilerleme kaybedilmesin diye.
 */
export class SaveManager {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly api: SaveApi | null,
    private readonly progress: Progress,
    private readonly playerName: string,
  ) {}

  get enabled(): boolean {
    return this.api !== null;
  }

  /** İlerlemeyi ve verilen kayıt noktasını yazar. Eşzamanlı çağrılar sırayla çalışır. */
  saveAt(point: SavePoint | null): Promise<SaveResult> {
    const api = this.api;
    if (!api) return Promise.resolve('disabled');
    // Kaydı çağrı anında çek: sıra beklerken ilerleme değişse bile o anki durum yazılır
    const data = buildSave(this.playerName, this.progress.snapshot().completedChapters, point);
    const run = async (): Promise<SaveResult> => {
      try {
        await api.putSave(data);
        return 'saved';
      } catch {
        return 'failed';
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result;
    return result;
  }
}
