import './style.css';

// Task 1 duman testi: iki motorun da yüklendiğini ve çizdiğini gösterir.
// Gerçek dünya (Task 4) ve arena (Task 12) bu modülleri değiştirecek.
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="mx-auto flex max-w-3xl flex-col items-center gap-4 p-4 text-center">
    <h1 class="text-3xl font-bold">MagicalBattle</h1>
    <p class="text-slate-400">Altyapı testi: iki motor da yüklendi mi?</p>
    <section class="grid w-full gap-4 sm:grid-cols-2">
      <div><h2 class="mb-1 text-sm">2D Dünya (Phaser)</h2><div id="world" class="aspect-square w-full overflow-hidden rounded bg-black"></div></div>
      <div><h2 class="mb-1 text-sm">3D Arena (Three.js)</h2><div id="battle" class="aspect-square w-full overflow-hidden rounded bg-black"></div></div>
    </section>
  </main>
`;

void import('./world/bootWorld').then((m) => m.bootWorld(document.querySelector('#world')!));
void import('./battle/bootBattle').then((m) => m.bootBattle(document.querySelector('#battle')!));
