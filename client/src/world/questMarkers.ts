import { LOCATIONS, approachTile } from './locations';
import { TILE_SIZE } from './tiles';

export interface MainQuestMarker {
  id: string;
  chapter: number;
  locationId: string;
  title: string;
  /** Dünya koordinatı (piksel), karonun merkezi */
  px: number;
  py: number;
}

const TITLES: Record<number, string> = {
  1: 'Köle İsyanı ve Lav Bacası Sabotajı',
  2: 'Ambargoyu Kır',
  3: 'Tapınağa Sız',
  4: 'Soyluları Kendi Tarafına Çek',
  5: 'Kalenin Temelini Salla',
  6: 'Sisi Dağıt',
  7: "Elysia'yı Kurtar",
  8: 'Gölge Hükümdarı',
};

/** Her bölümün ana görev işareti, konumunun yaklaşma karosunda durur. */
export const MAIN_QUEST_MARKERS: readonly MainQuestMarker[] = LOCATIONS.map((loc) => {
  const t = approachTile(loc);
  return {
    id: `main-ch${loc.chapter}`,
    chapter: loc.chapter,
    locationId: loc.id,
    title: TITLES[loc.chapter],
    px: t.x * TILE_SIZE + TILE_SIZE / 2,
    py: t.y * TILE_SIZE + TILE_SIZE / 2,
  };
});

/** Hangi bölümlerin ana görevi şu an aktif. Başlangıçta yalnızca 1. bölüm. */
export class QuestTracker {
  private readonly active = new Set<number>([1]);

  isActive(chapter: number): boolean {
    return this.active.has(chapter);
  }

  activate(chapter: number): void {
    this.active.add(chapter);
  }

  deactivate(chapter: number): void {
    this.active.delete(chapter);
  }

  /** Başlangıç durumuna döner (yalnızca 1. bölüm aktif). */
  reset(): void {
    this.active.clear();
    this.active.add(1);
  }

  activeMarkers(): MainQuestMarker[] {
    return MAIN_QUEST_MARKERS.filter((m) => this.active.has(m.chapter));
  }
}

/** `px, py` noktasına `range` pikselden yakın olan işaretler. */
export function markersInRange(
  markers: readonly MainQuestMarker[],
  px: number,
  py: number,
  range: number,
): MainQuestMarker[] {
  return markers.filter((m) => Math.hypot(m.px - px, m.py - py) <= range);
}
