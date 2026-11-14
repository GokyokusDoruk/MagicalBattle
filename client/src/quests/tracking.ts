import { cityCurrency, CURRENCY_NAMES } from '../economy/currency';
import { getItem } from '../economy/items';
import type { ChestSpot } from '../enemies/chests';
import type { MineSpot } from '../enemies/mines';
import { LOCATIONS } from '../world/locations';
import type { MainQuestMarker } from '../world/questMarkers';
import { TILE_SIZE } from '../world/tiles';
import type { QuestDef } from './catalog';

/**
 * Görev takibi (Task 41): oyuncunun aldığı görevleri (ana ve yan) tek bir listede toplar, her görev için kısa özet
 * ve haritada gidilecek yeri (varsa) verir. Görev günlüğü, orta üstteki özet ve yönlendirme oku bunu kullanır.
 */

export interface TrackTarget {
  /** Dünya koordinatı (piksel) */
  px: number;
  py: number;
  /** Hedefin adı ("Ignis Surları", "En yakın maden") */
  label: string;
}

export interface TrackEntry {
  id: string;
  kind: 'main' | 'side';
  title: string;
  /** Tek cümlelik "ne yapmalı": orta üstte gösterilir */
  summary: string;
  /** Ayrıntılı anlatım (günlükte) */
  description: string;
  /** İlerleme (yan görevler; ana görevde yok) */
  progress: { value: number; target: number } | null;
  /** Haritada gidilecek yer; yoksa (örn. "3 savaş kazan") ok çıkmaz */
  target: TrackTarget | null;
  rewardText: string | null;
}

const locName = (id: string): string => LOCATIONS.find((l) => l.id === id)?.name ?? id;

/** Hedefin kısa, tek satırlık metni (görev kartında ve özette). */
export function objectiveText(q: QuestDef): string {
  const o = q.objective;
  if (o.type === 'collect') return `${getItem(o.itemId)?.name ?? o.itemId} topla (${o.count})`;
  if (o.type === 'visit') return `${locName(o.locationId)} konumuna var`;
  if (o.type === 'deliver') return `${o.count} ${getItem(o.itemId)?.name ?? o.itemId} al ve ${locName(o.locationId)} şehrine götür`;
  if (o.type === 'mine') return o.count === 1 ? 'bir madeni temizle' : `${o.count} madeni temizle`;
  if (o.type === 'chest') return o.count === 1 ? 'bir korumalı sandık aç' : `${o.count} korumalı sandık aç`;
  return `${o.count} savaş kazan`;
}

export function rewardText(q: QuestDef): string {
  const parts = [`${q.reward.money} ${CURRENCY_NAMES[cityCurrency(q.giver)]}`, `${q.reward.xp} XP`];
  for (const it of q.reward.items ?? []) parts.push(`${it.count} ${getItem(it.id)?.name ?? it.id}`);
  return parts.join(', ');
}

const center = (x: number, y: number): { px: number; py: number } => ({ px: x * TILE_SIZE + TILE_SIZE / 2, py: y * TILE_SIZE + TILE_SIZE / 2 });

/** Ana görev girişi: işaretin durduğu yere git. */
export function mainEntry(marker: MainQuestMarker): TrackEntry {
  const place = locName(marker.locationId);
  return {
    id: `main-ch${marker.chapter}`,
    kind: 'main',
    title: marker.title,
    summary: `Ana görev: ${marker.title}`,
    description: `Ana hikâye (bölüm ${marker.chapter}). ${place} yakınındaki sarı ! işaretine git; sahneyi izle, savaşı ver ve seçimlerini yap.`,
    progress: null,
    target: { px: marker.px, py: marker.py, label: place },
    rewardText: null,
  };
}

export interface SideTargetContext {
  /** Oyuncunun konumu (piksel) */
  playerPx: number;
  playerPy: number;
  mines: readonly MineSpot[];
  chests: readonly ChestSpot[];
  /** Açılmış sandık mı */
  chestOpen: (id: string) => boolean;
}

const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

/** Yan görevin haritadaki hedefi: konum ve teslimat görevlerinde şehir, maden ve sandıkta en yakın olan; savaş ve toplamada yok. */
export function sideTarget(q: QuestDef, ctx: SideTargetContext): TrackTarget | null {
  const o = q.objective;
  if (o.type === 'visit' || o.type === 'deliver') {
    const loc = LOCATIONS.find((l) => l.id === o.locationId);
    return loc ? { ...center(loc.x, loc.y), label: loc.name } : null;
  }
  if (o.type === 'mine') {
    const best = [...ctx.mines].sort((a, b) => dist(a.tileX, a.tileY, ctx.playerPx / TILE_SIZE, ctx.playerPy / TILE_SIZE) - dist(b.tileX, b.tileY, ctx.playerPx / TILE_SIZE, ctx.playerPy / TILE_SIZE))[0];
    return best ? { ...center(best.tileX, best.tileY), label: best.name } : null;
  }
  if (o.type === 'chest') {
    const open = ctx.chests.filter((c) => !ctx.chestOpen(c.id));
    const best = [...open].sort((a, b) => dist(a.tileX, a.tileY, ctx.playerPx / TILE_SIZE, ctx.playerPy / TILE_SIZE) - dist(b.tileX, b.tileY, ctx.playerPx / TILE_SIZE, ctx.playerPy / TILE_SIZE))[0];
    return best ? { ...center(best.tileX, best.tileY), label: 'En yakın korumalı sandık' } : null;
  }
  return null;
}

export function sideEntry(q: QuestDef, progress: { value: number; target: number }, ctx: SideTargetContext): TrackEntry {
  return {
    id: q.id,
    kind: 'side',
    title: q.title,
    summary: `${q.title}: ${objectiveText(q)} (${progress.value}/${progress.target})`,
    description: q.description,
    progress,
    target: sideTarget(q, ctx),
    rewardText: rewardText(q),
  };
}

/**
 * Takip edilecek görev: seçilen hâlâ geçerliyse o, değilse ana görev, o da yoksa ilk yan görev, hiçbiri yoksa null.
 */
export function pickTracked(entries: readonly TrackEntry[], selectedId: string | null): TrackEntry | null {
  const chosen = entries.find((e) => e.id === selectedId);
  return chosen ?? entries.find((e) => e.kind === 'main') ?? entries[0] ?? null;
}

const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'] as const;

/** Oyuncudan hedefe yön: derece (0 = sağ, saat yönünde, ekranda yukarı = harita yukarısı), 8 yönlü ok ve karo uzaklığı. */
export function directionTo(fromPx: number, fromPy: number, target: Pick<TrackTarget, 'px' | 'py'>): { degrees: number; arrow: string; tiles: number } {
  const dx = target.px - fromPx;
  const dy = target.py - fromPy;
  const radians = Math.atan2(dy, dx);
  const idx = ((Math.round(radians / (Math.PI / 4)) % 8) + 8) % 8;
  return { degrees: (radians * 180) / Math.PI, arrow: ARROWS[idx], tiles: Math.round(Math.hypot(dx, dy) / TILE_SIZE) };
}
