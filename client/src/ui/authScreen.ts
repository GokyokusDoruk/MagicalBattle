import { ApiError, type ApiUser } from '../api/client';
import { DORUKPLAYS_URL } from './homeLink';

/** Girişin ihtiyaç duyduğu API parçası (testte sahtesi verilir). */
export interface EnterApi {
  login(username: string, password: string): Promise<ApiUser>;
  guest(username: string, password: string): Promise<ApiUser>;
}

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 8;

/** Formu sunucuya göndermeden denetler: sorun varsa kullanıcı dostu Türkçe mesaj, yoksa null. */
export function checkEntry(username: string, password: string): string | null {
  if (!username.trim()) return 'Büyücü adını yaz.';
  if (!USERNAME_PATTERN.test(username.trim())) return 'Ad 3-20 karakter olmalı; yalnızca harf (a-z), rakam ve _ kullanılabilir.';
  if (password.length < PASSWORD_MIN) return `Şifre en az ${PASSWORD_MIN} karakter olmalı.`;
  return null;
}

/**
 * Tek adımda giriş (Faz 1): önce bu ad ve şifreyle giriş denenir. Böyle bir hesap yoksa aynı ad ve şifreyle yeni hesap
 * açılır. Ad başkasına aitse (giriş tutmadı, ad da alınmış) şifre hatalı demektir.
 * Dönüş: kullanıcı ve hesabın yeni açılıp açılmadığı.
 */
export async function enterWithName(api: EnterApi, username: string, password: string): Promise<{ user: ApiUser; created: boolean }> {
  const name = username.trim();
  try {
    return { user: await api.login(name, password), created: false };
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
  }
  try {
    return { user: await api.guest(name, password), created: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      throw new ApiError(401, 'BAD_CREDENTIALS', 'Bu ad başka bir büyücüye ait ya da şifre hatalı. Şifreni kontrol edip tekrar dene.');
    }
    throw err;
  }
}

const INPUT =
  'mt-1 w-full rounded-lg bg-slate-800 px-3 py-3 text-lg text-amber-50 outline-none ring-1 ring-slate-600 focus:ring-amber-300';

/**
 * Giriş ekranı: yalnızca büyücü adı ve şifre. Ad yeniyse hesap kendiliğinden açılır, varsa şifreyle girilir.
 * Kayıt formu ve kayıtsız oyun yoktur; ilerleme her zaman hesaba kaydedilir.
 */
export function showAuthScreen(api: EnterApi): Promise<ApiUser> {
  const root = document.createElement('div');
  // Kaydırılabilir kap: dokunmatik kilidi (data-scrollable) ve pan-y ile telefonda form kaydırılır
  root.setAttribute('data-scrollable', '');
  root.style.touchAction = 'pan-y';
  root.className = 'fixed inset-0 z-[70] overflow-y-auto bg-slate-950';
  root.innerHTML = `
    <div class="mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 p-6">
      <div class="text-center">
        <h1 class="text-3xl font-bold text-amber-300">MagicalBattle</h1>
        <p class="mt-2 text-slate-300">Büyücü adını ve şifreni yaz. İlk kez geliyorsan hesabın kendiliğinden açılır.</p>
      </div>
      <form class="flex flex-col gap-3" novalidate>
        <label class="block text-sm text-slate-300">Büyücü adı
          <input name="username" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="20" required class="${INPUT}">
        </label>
        <label class="block text-sm text-slate-300">Şifre
          <input name="password" type="password" autocomplete="current-password" maxlength="72" required class="${INPUT}">
        </label>
        <p class="text-xs text-slate-500">Ad: 3-20 karakter, harf, rakam ve _. Şifre: en az ${PASSWORD_MIN} karakter.</p>
        <p data-error role="alert" class="min-h-[1.25rem] text-sm text-red-400 select-text"></p>
        <button type="submit" class="rounded-lg bg-amber-300 px-4 py-3 text-lg font-bold text-slate-900 disabled:opacity-50">Oyuna gir</button>
      </form>
      <a href="${DORUKPLAYS_URL}" class="text-center text-sm text-amber-200/80 hover:text-amber-200">← dorukplays'e dön</a>
    </div>`;
  document.body.appendChild(root);

  const formEl = root.querySelector<HTMLFormElement>('form')!;
  const errorEl = root.querySelector<HTMLElement>('[data-error]')!;
  const submitEl = root.querySelector<HTMLButtonElement>('[type=submit]')!;
  root.querySelector<HTMLInputElement>('[name=username]')!.focus();

  return new Promise((resolve) => {
    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(formEl)) as Record<string, string>;
      const problem = checkEntry(data.username ?? '', data.password ?? '');
      if (problem) {
        errorEl.textContent = problem;
        return;
      }
      submitEl.disabled = true;
      submitEl.textContent = 'Giriliyor…';
      errorEl.textContent = '';
      try {
        const { user } = await enterWithName(api, data.username, data.password);
        root.remove();
        resolve(user);
      } catch (err) {
        errorEl.textContent = err instanceof ApiError ? err.message : 'Beklenmeyen bir hata oluştu. Tekrar dene.';
        submitEl.disabled = false;
        submitEl.textContent = 'Oyuna gir';
      }
    });
  });
}
