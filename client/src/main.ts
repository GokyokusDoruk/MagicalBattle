import './style.css';

// ?lab=draw: büyü çizim laboratuvarı, ?lab=arena: 3D arena laboratuvarı (savaş gelmeden denemek için).
// Normalde oyun yüklenir. Hepsi ayrı parçalar olduğu için birbirini yavaşlatmaz.
const lab = new URLSearchParams(location.search).get('lab');
const app = document.querySelector<HTMLDivElement>('#app')!;
if (lab === 'draw') {
  const { startDrawLab } = await import('./ui/drawLab');
  startDrawLab(app);
} else if (lab === 'arena') {
  const { startArenaLab } = await import('./ui/arenaLab');
  startArenaLab(app);
} else {
  await import('./game');
}
