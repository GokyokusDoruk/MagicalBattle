import type { GateTile } from './generateMap';

/**
 * Şehir kapılarının kilit durumu. Hepsi kilitli başlar; bölümün ana görev
 * zinciri bitince `unlock` çağrılır (Task 6'da hikâye motoruna bağlanacak).
 */
export class GateRegistry {
  private readonly unlocked = new Set<string>();
  private readonly listeners = new Set<(cityId: string, unlocked: boolean) => void>();

  isUnlocked(cityId: string): boolean {
    return this.unlocked.has(cityId);
  }

  unlock(cityId: string): void {
    if (this.unlocked.has(cityId)) return;
    this.unlocked.add(cityId);
    this.listeners.forEach((l) => l(cityId, true));
  }

  lock(cityId: string): void {
    if (!this.unlocked.delete(cityId)) return;
    this.listeners.forEach((l) => l(cityId, false));
  }

  onChange(listener: (cityId: string, unlocked: boolean) => void): void {
    this.listeners.add(listener);
  }
}

/** Verilen karo kilitli bir kapıysa true. */
export function isLockedGateAt(gates: readonly GateTile[], registry: GateRegistry, tx: number, ty: number): boolean {
  const gate = gates.find((g) => g.x === tx && g.y === ty);
  return gate !== undefined && !registry.isUnlocked(gate.cityId);
}
