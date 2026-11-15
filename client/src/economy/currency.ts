import type { Element } from '../battle/damage/elements';
import { LOCATIONS, type LocationDef } from '../world/locations';

/**
 * Para birimleri (Task 35): altın kalktı, yerine dört birim geldi. Her biri bir elementin şehrine bağlıdır:
 * Kor (ateş, Ignis), Çiy (su, Still Crystal), Tunç (toprak, Stone Heart), Tüy (hava, Abyss).
 * Bir yerde kazanılan ve harcanan para o yerin birimidir; başka birime tüccarda çevrilir (%25 kayıpla).
 */

export type Currency = 'kor' | 'ciy' | 'tunc' | 'tuy';

export const CURRENCIES: readonly Currency[] = ['kor', 'ciy', 'tunc', 'tuy'];

export const CURRENCY_NAMES: Record<Currency, string> = { kor: 'Kor', ciy: 'Çiy', tunc: 'Tunç', tuy: 'Tüy' };
export const CURRENCY_ICONS: Record<Currency, string> = { kor: '🔥', ciy: '💧', tunc: '⛰️', tuy: '🪶' };

export const ELEMENT_CURRENCY: Record<Element, Currency> = { fire: 'kor', water: 'ciy', earth: 'tunc', air: 'tuy' };
export const CURRENCY_ELEMENT: Record<Currency, Element> = { kor: 'fire', ciy: 'water', tunc: 'earth', tuy: 'air' };

/** Bir birimden diğerine çevirirken kaybedilen oran */
export const CONVERT_LOSS = 0.25;

/** Bir cüzdandaki en yüksek bakiye (birim başına) */
export const MAX_MONEY = 9_999_999;

export type Wallet = Record<Currency, number>;

export const emptyWallet = (): Wallet => ({ kor: 0, ciy: 0, tunc: 0, tuy: 0 });

/** Çevirmede eline geçen miktar: %25 kayıp, aşağı yuvarlanır (100 → 75). */
export function convertedAmount(amount: number): number {
  return Math.floor(Math.max(0, Math.floor(amount)) * (1 - CONVERT_LOSS));
}

/** Bir konumun para birimi: şehir kendi elementininki; köyde iki elementten biri (`rand` ile); element yoksa (arena) Kor. */
export function locationCurrency(loc: Pick<LocationDef, 'elements'>, rand: () => number = Math.random): Currency {
  if (loc.elements.length === 0) return 'kor';
  const el = loc.elements.length === 1 ? loc.elements[0] : loc.elements[Math.floor(rand() * loc.elements.length)];
  return ELEMENT_CURRENCY[el];
}

/**
 * Görev ödülünün para birimi: görevi veren konumun **ilk** elementinin birimi (köyde rastgele değil, böylece görev kartındaki ödül ile
 * ödenen birim hep aynıdır).
 */
export function questCurrency(locationId: string): Currency {
  const loc = LOCATIONS.find((l) => l.id === locationId);
  return loc && loc.elements.length > 0 ? ELEMENT_CURRENCY[loc.elements[0]] : 'kor';
}

/** Bir şehrin (ya da konumun) kimliğinden para birimi; bilinmeyen kimlik Kor sayılır. */
export function cityCurrency(locationId: string, rand: () => number = Math.random): Currency {
  const loc = LOCATIONS.find((l) => l.id === locationId);
  return loc ? locationCurrency(loc, rand) : 'kor';
}

/** Haritadaki bir noktanın para birimi: en yakın şehrin birimi. */
export function currencyAt(locations: readonly LocationDef[], tileX: number, tileY: number): Currency {
  let best: LocationDef | null = null;
  let bestD = Infinity;
  for (const l of locations) {
    if (l.kind !== 'city') continue;
    const d = Math.hypot(l.x - tileX, l.y - tileY);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best ? locationCurrency(best) : 'kor';
}

/** "1.250 Kor" gibi biçimli tutar. */
export const formatMoney = (amount: number, currency: Currency): string => `${Math.round(amount).toLocaleString('tr-TR')} ${CURRENCY_NAMES[currency]}`;

const toInt = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(MAX_MONEY, Math.max(0, Math.floor(v))) : 0);

/** Kayıttan okunan cüzdanı temizler; eksik/bozuk birimler 0 olur. */
export function sanitizeWallet(raw: unknown): Wallet {
  const w = emptyWallet();
  if (raw && typeof raw === 'object') for (const c of CURRENCIES) w[c] = toInt((raw as Record<string, unknown>)[c]);
  return w;
}
