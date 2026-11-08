import './style.css';
import { getSoundEngine } from './audio/sfx/engine';
import { installAudioUnlock } from './ui/soundToggle';

// Tarayıcı sesi ilk dokunuştan sonra açar; bu kanca ilk etkileşimde ses motorunu hazırlar.
installAudioUnlock(getSoundEngine());

// ?lab=draw: büyü çizim laboratuvarı, ?lab=arena: 3D arena, ?lab=battle: botlara karşı savaş denemesi.
// Normalde oyun yüklenir. Hepsi ayrı parçalar olduğu için birbirini yavaşlatmaz.
const lab = new URLSearchParams(location.search).get('lab');
const app = document.querySelector<HTMLDivElement>('#app')!;
if (lab === 'draw') {
  const { startDrawLab } = await import('./ui/drawLab');
  startDrawLab(app);
} else if (lab === 'arena') {
  const { startArenaLab } = await import('./ui/arenaLab');
  startArenaLab(app);
} else if (lab === 'sound') {
  const { startSoundLab } = await import('./ui/soundLab');
  startSoundLab(app);
} else if (lab === 'battle') {
  const { startBattleLab } = await import('./ui/battleLab');
  startBattleLab(app);
} else {
  await import('./game');
}
