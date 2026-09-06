export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly avatarUrl?: string | null;
}

export interface AccessTokenPayload {
  readonly sub: string;
  readonly email: string;
}

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}
