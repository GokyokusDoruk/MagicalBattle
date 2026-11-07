/** Bir savaşçının arenadaki yeri: hangi takımda, kaçıncı sırada, nerede durduğu ve nereye baktığı. */
export interface Slot {
  team: 0 | 1;
  index: number;
  position: { x: number; y: number; z: number };
  /** Y ekseni etrafında dönüş (radyan). Model +z'ye bakar; 0 = +z, π/2 = +x. */
  yaw: number;
}

export interface SlotRef {
  team: 0 | 1;
  index: number;
}

export const TEAM_X = 5.5;
const SIDE_Z = 2.2;
const STAGGER_X = 0.8;

/**
 * Takımları arenaya dizer: takım 0 solda (+x'e bakar), takım 1 sağda (-x'e bakar).
 * Takım başına 1 ya da 2 kişi desteklenir (1v1, 2v2). 2 kişilik takımda ilk kişi öne, ikincisi arkaya durur.
 */
export function layoutTeams(sizes: readonly [number, number]): Slot[] {
  const slots: Slot[] = [];
  ([0, 1] as const).forEach((team) => {
    const size = sizes[team];
    if (!Number.isInteger(size) || size < 1 || size > 2) {
      throw new Error(`Takım ${team} için geçersiz kişi sayısı: ${size} (1 ya da 2 olmalı)`);
    }
    const dir = team === 0 ? -1 : 1; // takımın dış tarafı
    for (let index = 0; index < size; index++) {
      const z = size === 1 ? 0 : index === 0 ? -SIDE_Z : SIDE_Z;
      const back = size === 1 || index === 0 ? 0 : STAGGER_X; // ikinci kişi biraz arkada
      slots.push({
        team,
        index,
        position: { x: dir * (TEAM_X + back), y: 0, z },
        yaw: team === 0 ? Math.PI / 2 : -Math.PI / 2,
      });
    }
  });
  return slots;
}

export const slotKey = (ref: SlotRef): string => `${ref.team}:${ref.index}`;
