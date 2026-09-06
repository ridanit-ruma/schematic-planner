import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { customAlphabet } from 'nanoid';

import { hashToken, randomToken } from '../common/crypto.js';
import { PrismaService } from '../common/prisma.service.js';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import type { AuthUser } from './auth.types.js';
import type {
  ChangePasswordInput,
  CreateApiKeyInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from './auth.dto.js';
import { durationToMs } from './duration.js';

const suffix = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

/** Shown in the settings list so a key can be told apart without revealing it. */
const API_KEY_PREFIX = 'sp_';
const API_KEY_PREFIX_LENGTH = 8;

export interface AuthResult {
  readonly user: AuthUser;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(input: RegisterInput, userAgent?: string): Promise<AuthResult> {
    if (!this.config.allowRegistration) {
      throw new ForbiddenException('Registration is closed on this instance');
    }

    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing !== null) throw new ConflictException('That email is already registered');

    const user = await this.prisma.user.create({
      data: {
        email,
        name: input.name,
        passwordHash: await argon2.hash(input.password),
        // Everyone gets a workspace immediately: a plan has to live somewhere,
        // and asking a new user to create one first is a step with no decision
        // in it.
        memberships: {
          create: {
            role: 'OWNER',
            workspace: {
              create: {
                name: `${input.name}'s workspace`,
                slug: await this.freeSlug(input.name),
                // A plan needs a project to live in, so one exists from the
                // start. Nobody should have to create a container before they
                // can write down an idea.
                projects: { create: { slug: 'general', name: 'General' } },
              },
            },
          },
        },
      },
    });

    return this.issue({ id: user.id, email: user.email, name: user.name }, userAgent);
  }

  async login(input: LoginInput, userAgent?: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });

    // Hash even when the user does not exist so that a missing account and a
    // wrong password take the same amount of time to answer.
    const hash = user?.passwordHash ?? (await argon2.hash(randomToken()));
    const valid = await argon2.verify(hash, input.password).catch(() => false);

    if (user === null || user.passwordHash === null || !valid) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    return this.issue({ id: user.id, email: user.email, name: user.name }, userAgent);
  }

  /**
   * Refresh tokens rotate: the presented one is consumed and a new one issued.
   * A token that is replayed after rotation no longer matches any session.
   */
  async refresh(token: string, userAgent?: string): Promise<AuthResult> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (session === null || session.expiresAt.getTime() < Date.now()) {
      if (session !== null) await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Session expired');
    }

    await this.prisma.session.delete({ where: { id: session.id } });
    const { id, email, name } = session.user;
    return this.issue({ id, email, name }, userAgent);
  }

  async logout(token: string | undefined): Promise<void> {
    if (token === undefined) return;
    await this.prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: input.name },
    });
    return { id: user.id, email: user.email, name: user.name };
  }

  /**
   * Changing a password ends every other session. Someone who changes it because
   * they think it leaked expects exactly that, and leaving old sessions alive
   * would quietly defeat the point.
   */
  async changePassword(userId: string, input: ChangePasswordInput, keepToken?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user === null || user.passwordHash === null) {
      throw new BadRequestException('This account has no password set');
    }

    const valid = await argon2.verify(user.passwordHash, input.currentPassword).catch(() => false);
    if (!valid) throw new UnauthorizedException('That is not your current password');

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(input.newPassword) },
    });
    await this.prisma.session.deleteMany({
      where: {
        userId,
        ...(keepToken !== undefined && { NOT: { tokenHash: hashToken(keepToken) } }),
      },
    });

    return { ok: true as const };
  }

  async sessions(userId: string, currentToken?: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const currentHash = currentToken === undefined ? null : hashToken(currentToken);

    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      current: session.tokenHash === currentHash,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.prisma.session.deleteMany({ where: { id: sessionId, userId } });
    return { ok: true as const };
  }

  async revokeOtherSessions(userId: string, keepToken?: string) {
    await this.prisma.session.deleteMany({
      where: {
        userId,
        ...(keepToken !== undefined && { NOT: { tokenHash: hashToken(keepToken) } }),
      },
    });
    return { ok: true as const };
  }

  /**
   * Everything the account owns goes with it — workspaces where it is the only
   * owner, and every project and plan inside them. Cascades in the schema do the
   * work; this only checks that the person meant it.
   */
  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user === null) throw new UnauthorizedException();
    if (user.passwordHash === null) throw new BadRequestException('This account has no password');

    const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!valid) throw new UnauthorizedException('That is not your password');

    await this.prisma.user.delete({ where: { id: userId } });
    return { ok: true as const };
  }

  async listApiKeys(userId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      include: { workspace: { select: { slug: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      // Present only on a key issued under the older per-workspace model.
      restrictedTo: key.workspace === null ? null : key.workspace.slug,
    }));
  }

  /**
   * Returns the key in full. This is the only moment it exists outside the
   * caller's machine — the database keeps a hash.
   *
   * The key acts as its owner in every workspace they belong to, because
   * somebody working across several should not have to issue, paste and revoke
   * one per workspace.
   */
  async createApiKey(userId: string, input: CreateApiKeyInput) {
    const secret = `${API_KEY_PREFIX}${randomToken(24)}`;
    const key = await this.prisma.apiKey.create({
      data: {
        userId,
        name: input.name,
        prefix: secret.slice(0, API_KEY_PREFIX_LENGTH),
        hash: hashToken(secret),
      },
    });

    return {
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      key: secret,
      mcpUrl: `${this.config.apiPublicUrl}/mcp`,
    };
  }

  async revokeApiKey(userId: string, keyId: string) {
    await this.prisma.apiKey.updateMany({
      where: { id: keyId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true as const };
  }

  async userById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user === null ? null : { id: user.id, email: user.email, name: user.name };
  }

  private async issue(user: AuthUser, userAgent?: string): Promise<AuthResult> {
    const refreshToken = randomToken();
    const refreshExpiresAt = new Date(Date.now() + durationToMs(this.config.refreshTokenTtl));

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
        ...(userAgent !== undefined && { userAgent: userAgent.slice(0, 300) }),
      },
    });

    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { user, accessToken, refreshToken, refreshExpiresAt };
  }

  private async freeSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'workspace';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${suffix()}`;
      const taken = await this.prisma.workspace.findUnique({ where: { slug: candidate } });
      if (taken === null) return candidate;
    }
    return `${base}-${suffix()}`;
  }
}
