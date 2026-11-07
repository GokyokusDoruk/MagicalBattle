import { validatePlayerName } from '../save/saveData';

/** Yeni oyunun başında oyuncunun adını sorar. Geçerli ad girilene kadar kapanmaz. */
export function askPlayerName(suggestion = ''): Promise<string> {
  const root = document.createElement('div');
  root.setAttribute('data-scrollable', '');
  root.style.touchAction = 'pan-y';
  root.className = 'fixed inset-0 z-[70] overflow-y-auto bg-slate-950';
  root.innerHTML = `
    <form class="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-6" novalidate>
      <h1 class="text-center text-2xl font-bold text-amber-300">Yolculuk başlıyor</h1>
      <p class="text-center text-slate-300">Elmora'nın son Bekçi çırağı, adın nedir?</p>
      <input name="name" maxlength="20" autocomplete="nickname" required value="${suggestion.replace(/"/g, '')}"
        class="w-full rounded bg-slate-800 px-3 py-3 text-center text-xl text-amber-50 outline-none ring-1 ring-slate-600 focus:ring-amber-300">
      <p data-error role="alert" class="min-h-[1.25rem] text-center text-sm text-red-400"></p>
      <button type="submit" class="rounded bg-amber-300 px-4 py-3 font-bold text-slate-900">Başla</button>
    </form>`;
  document.body.appendChild(root);

  const form = root.querySelector('form')!;
  const input = root.querySelector<HTMLInputElement>('input')!;
  const errorEl = root.querySelector<HTMLElement>('[data-error]')!;
  input.focus();

  return new Promise((resolve) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const problem = validatePlayerName(input.value);
      if (problem) {
        errorEl.textContent = problem;
        return;
      }
      root.remove();
      resolve(input.value.trim());
    });
  });
}
