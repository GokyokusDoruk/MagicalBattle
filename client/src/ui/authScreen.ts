import { ApiError, type ApiClient, type ApiUser } from '../api/client';

type Mode = 'login' | 'register' | 'guest';

const TABS: { mode: Mode; label: string }[] = [
  { mode: 'login', label: 'Giriş yap' },
  { mode: 'register', label: 'Kayıt ol' },
  { mode: 'guest', label: 'Misafir' },
];

const INPUT =
  'w-full rounded bg-slate-800 px-3 py-2 text-base text-amber-50 outline-none ring-1 ring-slate-600 focus:ring-amber-300';

function field(name: string, label: string, type = 'text', autocomplete = 'off'): string {
  return `<label class="block text-sm text-slate-300">${label}
    <input name="${name}" type="${type}" autocomplete="${autocomplete}" required class="${INPUT} mt-1"
      ${type === 'password' ? 'minlength="8" maxlength="72"' : ''}></label>`;
}

const FORMS: Record<Mode, { fields: string; submit: string; note: string }> = {
  login: {
    fields: field('username', 'Kullanıcı adı', 'text', 'username') + field('password', 'Şifre', 'password', 'current-password'),
    submit: 'Giriş yap',
    note: '',
  },
  register: {
    fields:
      field('firstName', 'Ad', 'text', 'given-name') +
      field('lastName', 'Soyad', 'text', 'family-name') +
      field('email', 'E-posta', 'email', 'email') +
      field('username', 'Kullanıcı adı (harf, rakam, _)', 'text', 'username') +
      field('password', 'Şifre (en az 8 karakter)', 'password', 'new-password'),
    submit: 'Hesap oluştur',
    note: '',
  },
  guest: {
    fields: field('username', 'Kullanıcı adı (harf, rakam, _)', 'text', 'username') + field('password', 'Şifre (en az 8 karakter)', 'password', 'new-password'),
    submit: 'Misafir olarak başla',
    note: 'Misafir hesabın da kaydedilir. Aynı kullanıcı adı ve şifreyle sonra giriş yapıp kaldığın yerden devam edebilirsin.',
  },
};

/**
 * Giriş, kayıt ve misafir ekranı. Başarılı olunca kullanıcıyı, "Kayıtsız oyna" seçilirse null döndürür.
 */
export function showAuthScreen(api: ApiClient): Promise<ApiUser | null> {
  const root = document.createElement('div');
  // Kaydırılabilir kap: dokunmatik kilidi (data-scrollable) ve pan-y ile telefonda uzun form kaydırılır
  root.setAttribute('data-scrollable', '');
  root.style.touchAction = 'pan-y';
  root.className = 'fixed inset-0 z-[70] overflow-y-auto bg-slate-950';
  document.body.appendChild(root);

  return new Promise((resolve) => {
    let mode: Mode = 'login';

    const finish = (user: ApiUser | null): void => {
      root.remove();
      resolve(user);
    };

    const render = (error = ''): void => {
      const form = FORMS[mode];
      root.innerHTML = `
        <div class="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-6">
          <h1 class="text-center text-3xl font-bold text-amber-300">MagicalBattle</h1>
          <div role="tablist" class="grid grid-cols-3 gap-1 rounded bg-slate-900 p-1">
            ${TABS.map(
              (t) => `<button type="button" role="tab" data-tab="${t.mode}" aria-selected="${t.mode === mode}"
                class="rounded px-2 py-2 text-sm ${t.mode === mode ? 'bg-amber-300 font-bold text-slate-900' : 'text-slate-300 hover:bg-slate-800'}">${t.label}</button>`,
            ).join('')}
          </div>
          <form class="flex flex-col gap-3" novalidate>
            ${form.fields}
            ${form.note ? `<p class="text-sm text-slate-400">${form.note}</p>` : ''}
            <p data-error role="alert" class="min-h-[1.25rem] text-sm text-red-400 select-text">${error}</p>
            <button type="submit" class="rounded bg-amber-300 px-4 py-3 font-bold text-slate-900 disabled:opacity-50">${form.submit}</button>
          </form>
          <button type="button" data-offline class="text-sm text-slate-400 underline">Kayıtsız oyna (ilerleme kaydedilmez)</button>
        </div>`;

      root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
        b.addEventListener('click', () => {
          mode = b.dataset.tab as Mode;
          render();
        }),
      );
      root.querySelector('[data-offline]')!.addEventListener('click', () => finish(null));

      const formEl = root.querySelector<HTMLFormElement>('form')!;
      const errorEl = root.querySelector<HTMLElement>('[data-error]')!;
      const submitEl = root.querySelector<HTMLButtonElement>('[type=submit]')!;
      formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(formEl)) as Record<string, string>;
        const invalid = formEl.querySelector<HTMLInputElement>(':invalid');
        if (invalid) {
          errorEl.textContent =
            invalid.name === 'password' && invalid.value
              ? 'Şifre en az 8 karakter olmalı.'
              : invalid.name === 'email' && invalid.value
                ? 'Geçerli bir e-posta adresi gir.'
                : 'Lütfen tüm alanları doldur.';
          invalid.focus();
          return;
        }
        submitEl.disabled = true;
        errorEl.textContent = '';
        try {
          const user =
            mode === 'login'
              ? await api.login(data.username, data.password)
              : mode === 'guest'
                ? await api.guest(data.username, data.password)
                : await api.register({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    username: data.username,
                    password: data.password,
                  });
          finish(user);
        } catch (err) {
          errorEl.textContent = err instanceof ApiError ? err.message : 'Beklenmeyen bir hata oluştu.';
          submitEl.disabled = false;
        }
      });
    };

    render();
  });
}
