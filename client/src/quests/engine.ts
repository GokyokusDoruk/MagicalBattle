import { getItem } from '../economy/items';
import { questCurrency, type Currency } from '../economy/currency';
import type { PlayerState } from '../economy/player';
import { sellPrice } from '../economy/shop';
import { SIDE_QUESTS, type QuestDef } from './catalog';

export type QuestStatus = 'active' | 'completed';

export interface QuestRecord {
  status: QuestStatus;
  progress: number;
}

/** Tüccarın listesindeki durum: `locked` = seviye yetmiyor. */
export type QuestView = 'available' | 'locked' | 'active' | 'completed';

export type QuestEvent =
  | { type: 'collect' }
  | { type: 'visit'; locationId: string }
  | { type: 'battleWon' }
  | { type: 'mineCleared' }
  | { type: 'chestOpened' };

export interface QuestCompletion {
  quest: QuestDef;
  /** Ödülün para birimi (görevi veren şehrin birimi) ve miktarı */
  currency: Currency;
  money: number;
  xp: number;
  items: { id: string; count: number }[];
  levelsGained: number;
  /** Çanta dolu olduğu için paraya çevrilen ödül eşyalarının parası (0 = hepsi çantaya girdi) */
  overflowMoney: number;
}

export type AcceptResult = { ok: true; completion?: QuestCompletion } | { ok: false; reason: string };

export type QuestSnapshot = Record<string, QuestRecord>;

const targetOf = (q: QuestDef): number => (q.objective.type === 'visit' ? 1 : q.objective.count);

/**
 * Yan görev motoru (not: yükleme sırası önemlidir, önce oyuncu durumu, sonra görevler yüklenir). Görev kabul edilir, olaylarla (eşya toplama, konuma varma, savaş kazanma) ilerler;
 * hedef bitince ödül **kendiliğinden** oyuncuya yatar, teslim etmek gerekmez.
 */
export class QuestEngine {
  private readonly records = new Map<string, QuestRecord>();
  /** Toplama görevlerinde son görülen çanta miktarı: yalnızca ARTIŞ ilerleme sayılır, satış ilerlemeyi silmez */
  private readonly seen = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  /** Para ödülü çarpanı: ahlak sistemi (Düzen Bekçisi daha çok para verir, Task 18). 1 = etkisiz. */
  moneyMultiplier = 1;

  constructor(
    private readonly player: PlayerState,
    private readonly catalog: readonly QuestDef[] = SIDE_QUESTS,
  ) {
    // Eşya satılınca ya da harcanınca "görülen miktar" düşer; sonradan toplananlar yeniden sayılsın diye
    player.onChange(() => this.syncSeenDown());
  }

  private syncSeenDown(): void {
    for (const [id, seen] of this.seen) {
      const q = this.def(id);
      if (q?.objective.type !== 'collect') continue;
      const now = this.player.count(q.objective.itemId);
      if (now < seen) this.seen.set(id, now);
    }
  }

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  private changed(): void {
    this.listeners.forEach((l) => l());
  }

  private def(id: string): QuestDef | undefined {
    return this.catalog.find((q) => q.id === id);
  }

  /** Bir köyün tüccarının verdiği görevler. */
  forGiver(locationId: string): QuestDef[] {
    return this.catalog.filter((q) => q.giver === locationId);
  }

  active(): QuestDef[] {
    return this.catalog.filter((q) => this.records.get(q.id)?.status === 'active');
  }

  view(id: string): QuestView {
    const q = this.def(id);
    const rec = this.records.get(id);
    if (rec) return rec.status;
    return q && this.player.level < (q.minLevel ?? 1) ? 'locked' : 'available';
  }

  /** İlerleme (örn. 3 / 5). */
  progress(id: string): { value: number; target: number } {
    const q = this.def(id);
    return { value: this.records.get(id)?.progress ?? 0, target: q ? targetOf(q) : 0 };
  }

  accept(id: string): AcceptResult {
    const q = this.def(id);
    if (!q) return { ok: false, reason: 'Böyle bir görev yok.' };
    const view = this.view(id);
    if (view === 'active') return { ok: false, reason: 'Bu görev zaten sürüyor.' };
    if (view === 'completed') return { ok: false, reason: 'Bu görevi zaten tamamladın.' };
    if (view === 'locked') return { ok: false, reason: `Bu görev için ${q.minLevel}. seviye gerekli.` };

    this.records.set(id, { status: 'active', progress: 0 });
    // Hedef zaten sağlanmış olabilir (çantada yeterli ot varsa): hemen tamamlanır
    const completion = this.evaluate(q);
    this.changed();
    return { ok: true, completion };
  }

  /** Bir olayı işler; bu olayla tamamlanan görevleri (ödülleri yatmış olarak) döndürür. */
  onEvent(event: QuestEvent): QuestCompletion[] {
    const done: QuestCompletion[] = [];
    for (const q of this.active()) {
      const o = q.objective;
      const rec = this.records.get(q.id)!;
      if (o.type === 'visit' && event.type === 'visit' && event.locationId === o.locationId) rec.progress = 1;
      if (o.type === 'battleWon' && event.type === 'battleWon') rec.progress = Math.min(o.count, rec.progress + 1);
      if (o.type === 'mine' && event.type === 'mineCleared') rec.progress = Math.min(o.count, rec.progress + 1);
      if (o.type === 'chest' && event.type === 'chestOpened') rec.progress = Math.min(o.count, rec.progress + 1);
      // Teslimat: hedef şehre varınca yeterli mal taşıyorsan mal alınır ve görev biter; yetmiyorsa ilerleme olmaz
      if (o.type === 'deliver' && event.type === 'visit' && event.locationId === o.locationId && this.player.count(o.itemId) >= o.count) {
        this.player.removeItem(o.itemId, o.count);
        rec.progress = o.count;
      }
      if (o.type === 'collect' && event.type === 'collect') {
        const now = this.player.count(o.itemId);
        const gained = Math.max(0, now - (this.seen.get(q.id) ?? now));
        rec.progress = Math.min(o.count, rec.progress + gained);
        this.seen.set(q.id, now);
      }
      const completion = this.completeIfDone(q);
      if (completion) done.push(completion);
    }
    this.changed();
    return done;
  }

  /** Kabul anında hedefin sağlanıp sağlanmadığına bakar. */
  private evaluate(q: QuestDef): QuestCompletion | undefined {
    const rec = this.records.get(q.id)!;
    if (q.objective.type === 'collect') {
      const now = this.player.count(q.objective.itemId);
      rec.progress = Math.min(q.objective.count, now);
      this.seen.set(q.id, now);
    }
    return this.completeIfDone(q);
  }

  private completeIfDone(q: QuestDef): QuestCompletion | undefined {
    const rec = this.records.get(q.id)!;
    if (rec.status !== 'active' || rec.progress < targetOf(q)) return undefined;
    rec.status = 'completed';
    rec.progress = targetOf(q);

    const currency = questCurrency(q.giver);
    const money = Math.round(q.reward.money * this.moneyMultiplier);
    const items = q.reward.items ?? [];
    this.player.addMoney(currency, money);
    // Çanta doluysa sığmayan ödül eşyası kaybolmaz: değerinin yarısı para olarak verilir
    let overflowMoney = 0;
    for (const it of items) {
      const added = this.player.addItemPartial(it.id, it.count);
      const left = it.count - added;
      const def = getItem(it.id);
      if (left > 0 && def) overflowMoney += sellPrice(def.price) * left;
    }
    if (overflowMoney > 0) this.player.addMoney(currency, overflowMoney);
    const levelsGained = this.player.addXp(q.reward.xp);
    return { quest: q, currency, money, xp: q.reward.xp, items, levelsGained, overflowMoney };
  }

  snapshot(): QuestSnapshot {
    return Object.fromEntries([...this.records].map(([id, r]) => [id, { ...r }]));
  }

  /** Kayıttan yükler. Bilinmeyen görevler atılır, ilerleme hedefle sınırlanır. */
  restore(snapshot: Partial<QuestSnapshot> | undefined): void {
    this.records.clear();
    this.seen.clear();
    for (const [id, rec] of Object.entries(snapshot ?? {})) {
      const q = this.def(id);
      if (!q || !rec || (rec.status !== 'active' && rec.status !== 'completed')) continue;
      const target = targetOf(q);
      const progress = typeof rec.progress === 'number' && Number.isFinite(rec.progress) ? Math.min(target, Math.max(0, Math.floor(rec.progress))) : 0;
      this.records.set(id, rec.status === 'completed' ? { status: 'completed', progress: target } : { status: 'active', progress });
      if (rec.status === 'active' && q.objective.type === 'collect') this.seen.set(id, this.player.count(q.objective.itemId));
    }
    this.changed();
  }
}
