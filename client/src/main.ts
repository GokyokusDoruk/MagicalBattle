import './style.css';

// ?lab=draw: büyü çizim laboratuvarı (savaş gelmeden çizim kurallarını denemek için).
// Normalde oyun yüklenir. İkisi ayrı parçalar olduğu için birbirini yavaşlatmaz.
const lab = new URLSearchParams(location.search).get('lab');
if (lab === 'draw') {
  const { startDrawLab } = await import('./ui/drawLab');
  startDrawLab(document.querySelector<HTMLDivElement>('#app')!);
} else {
  await import('./game');
}
