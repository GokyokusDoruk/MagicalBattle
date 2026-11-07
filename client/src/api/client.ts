import type { SaveData } from '../save/saveData';

export interface ApiUser {
  id: string;
  username: string;
  isGuest: boolean;
  firstName: string | null;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
}

/** Sunucudan dönen hata. `status` 0 ise sunucuya hiç ulaşılamamıştır. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

/** Hangi sunucuya bağlanılacağı: ortam değişkeni > dorukplays.com > yerel geliştirme. */
export function resolveApiUrl(hostname: string, envUrl?: string): string {
  if (envUrl) return envUrl.replace(/\/+$/, '');
  if (hostname === 'dorukplays.com' || hostname.endsWith('.dorukplays.com')) return 'https://api.dorukplays.com';
  return 'http://localhost:3000';
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** Sunucu API'si. Oturum HttpOnly çerezle tutulur, bu yüzden hep `credentials: 'include'`. */
export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: FetchFn = (input, init) => fetch(input, init),
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        credentials: 'include',
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'NETWORK', 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.');
    }

    const payload = (await response.json().catch(() => ({}))) as { code?: string; error?: string };
    if (!response.ok) {
      throw new ApiError(response.status, payload.code ?? 'ERROR', payload.error ?? 'Bir hata oluştu.');
    }
    return payload as T;
  }

  /** Açık oturum varsa kullanıcıyı, yoksa null döndürür. */
  async me(): Promise<ApiUser | null> {
    try {
      return (await this.request<{ user: ApiUser }>('GET', '/auth/me')).user;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  }

  async register(input: RegisterInput): Promise<ApiUser> {
    return (await this.request<{ user: ApiUser }>('POST', '/auth/register', input)).user;
  }

  async guest(username: string, password: string): Promise<ApiUser> {
    return (await this.request<{ user: ApiUser }>('POST', '/auth/guest', { username, password })).user;
  }

  async login(username: string, password: string): Promise<ApiUser> {
    return (await this.request<{ user: ApiUser }>('POST', '/auth/login', { username, password })).user;
  }

  async logout(): Promise<void> {
    await this.request('POST', '/auth/logout', {});
  }

  async getSave(): Promise<SaveData | null> {
    return (await this.request<{ save: SaveData | null }>('GET', '/save')).save;
  }

  async putSave(data: SaveData): Promise<void> {
    await this.request('PUT', '/save', data);
  }
}
