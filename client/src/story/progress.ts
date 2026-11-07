import type { GateRegistry } from '../world/gates';
import { LOCATIONS, type LocationDef } from '../world/locations';
import type { QuestTracker } from '../world/questMarkers';

export const LAST_CHAPTER = 8;

export interface ProgressSnapshot {
  completedChapters: number[];
}

/**
 * Hikâye ilerlemesi. Bir bölüm tamamlanınca:
 * - o bölgenin şehir kapısı açılır (köy ve son arenada kapı yoktur),
 * - o bölümün ana görev işareti kalkar, sonraki bölümünki belirir.
 * Kayıt/yükleme için `snapshot` ve `restore` kullanılır (Task 8).
 */
export class Progress {
  private readonly completed = new Set<number>();
  private readonly listeners = new Set<(chapter: number) => void>();

  constructor(
    private readonly gates: GateRegistry,
    private readonly quests: QuestTracker,
    private readonly locations: readonly LocationDef[] = LOCATIONS,
  ) {}

  isCompleted(chapter: number): boolean {
    return this.completed.has(chapter);
  }

  /** Bölüm ilk kez tamamlandıysa true, zaten tamamlanmışsa false. */
  completeChapter(chapter: number): boolean {
    if (this.completed.has(chapter)) return false;
    this.apply(chapter);
    this.listeners.forEach((l) => l(chapter));
    return true;
  }

  onChapterCompleted(listener: (chapter: number) => void): void {
    this.listeners.add(listener);
  }

  snapshot(): ProgressSnapshot {
    return { completedChapters: [...this.completed].sort((a, b) => a - b) };
  }

  /** Kayıttan geri yükler: önce her şeyi sıfırlar, sonra bölümleri sırayla uygular. */
  restore(snapshot: ProgressSnapshot): void {
    this.completed.clear();
    this.gates.lockAll();
    this.quests.reset();
    for (const chapter of [...snapshot.completedChapters].sort((a, b) => a - b)) this.apply(chapter);
  }

  private apply(chapter: number): void {
    this.completed.add(chapter);
    this.quests.deactivate(chapter);
    if (chapter < LAST_CHAPTER) this.quests.activate(chapter + 1);
    const city = this.locations.find((l) => l.chapter === chapter && l.kind === 'city');
    if (city) this.gates.unlock(city.id);
  }
}
