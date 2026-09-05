export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
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
