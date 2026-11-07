import { CITY_HALF, type LocationDef } from '../world/locations';

/** Karo surların İÇİNDEyse o şehrin kimliğini, değilse null döndürür. */
export function cityAt(locations: readonly LocationDef[], tileX: number, tileY: number): string | null {
  for (const loc of locations) {
    if (loc.kind !== 'city') continue;
    if (Math.abs(tileX - loc.x) < CITY_HALF && Math.abs(tileY - loc.y) < CITY_HALF) return loc.id;
  }
  return null;
}

/** Her karede bulunulan şehri verince, yalnızca şehre YENİ girildiği anı bildirir. */
export class CityEntryTracker {
  /** `initial`: oyun zaten şehrin içinde başlıyorsa (kayıttan devam) o şehir, yeniden "giriş" sayılmasın. */
  constructor(private current: string | null = null) {}

  /** Şehre yeni girildiyse şehrin kimliği, aksi halde null. */
  update(cityId: string | null): string | null {
    const entered = cityId !== null && cityId !== this.current ? cityId : null;
    this.current = cityId;
    return entered;
  }
}
