export interface NewUser {
  username: string;
  usernameKey: string;
  passwordHash: string;
  isGuest: boolean;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export interface UserRecord extends NewUser {
  id: string;
  createdAt: Date;
}

/** Kullanıcı adı ya da e-posta başka bir hesapta kullanılıyor. */
export class DuplicateError extends Error {
  constructor(readonly field: 'username' | 'email') {
    super(`${field} zaten kayıtlı`);
  }
}

export interface UserRepository {
  /** Kullanıcı adı/e-posta çakışırsa DuplicateError fırlatır. */
  create(user: NewUser): Promise<UserRecord>;
  findByUsernameKey(key: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}
