import type { FinalPath } from '../morality/morality';

/** Elysia'nın hikâyedeki seyri (docs/hikaye.md bölüm 6). */
export type ElysiaStatus = 'meeting' | 'absent' | 'ally' | 'captured' | 'rescued' | 'betrayed';

/** Bölüm başında (o bölümün boss savaşı sırasında) Elysia'nın durumu. */
export function elysiaStatus(chapter: number, path: FinalPath = 'order'): ElysiaStatus {
  switch (chapter) {
    case 1:
      return 'meeting'; // tanışma sahnesi, savaşta yok
    case 2:
      return 'absent'; // kısa ziyaret
    case 3:
      return 'ally'; // katılır, ilk 2v2
    case 4:
      return 'ally'; // bölüm sonunda yakalanır; savaş sırasında yanında
    case 5:
    case 6:
      return 'captured'; // yok, oyuncu yalnız (flashback ile anılır)
    case 7:
      return 'rescued'; // bölüm sonunda kurtarılır; savaşta Morwenna'nın kontrolünde
    case 8:
      return path === 'order' ? 'ally' : 'betrayed';
    default:
      return 'absent';
  }
}

/** O bölümün boss savaşı 2v2 mi (Elysia oyuncunun yanında savaşır)? Bölüm 3 ve Düzen Bekçisi yolunda bölüm 8. */
export function elysiaFightsAlongside(chapter: number, path: FinalPath = 'order'): boolean {
  if (chapter === 3) return true;
  if (chapter === 8) return path === 'order';
  return false;
}
