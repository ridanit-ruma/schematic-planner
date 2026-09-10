export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly avatarUrl?: string | null;
  /**
   * Standing in the instance. Carried on the answers that sign somebody in as
   * well as the one that says who they are: without it the moment after signing
   * in is the one moment an owner is not told they are one, and the screen they
   * own is missing until they reload.
   */
  readonly instanceRole?: 'OWNER' | 'MEMBER';
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
