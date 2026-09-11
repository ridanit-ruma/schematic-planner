import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { AGENT_READABLE } from './agent-readable.decorator.js';
import { ApiKeyService } from './api-key.service.js';
import type { AccessTokenPayload } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { IS_PUBLIC } from './public.decorator.js';

/**
 * Applied globally, so a new route is protected unless it says otherwise. The
 * alternative — remembering to guard each controller — fails silently.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly keys: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (header === undefined || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing access token');
    }

    const token = header.slice(7);

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      // A route an agent may read also takes an MCP key, which acts as the
      // person who issued it. Tried second, so a session is still the ordinary
      // way in and a bad session token is not quietly looked up as a key.
      const agentReadable = this.reflector.getAllAndOverride<boolean>(AGENT_READABLE, [
        context.getHandler(),
        context.getClass(),
      ]);
      const identity =
        agentReadable === true ? await this.keys.resolve(token.trim()) : null;
      if (identity === null) throw new UnauthorizedException('Invalid or expired access token');

      const owner = await this.auth.userById(identity.userId);
      if (owner === null) throw new UnauthorizedException('Account no longer exists');
      request.user = owner;
      return true;
    }

    const user = await this.auth.userById(payload.sub);
    if (user === null) throw new UnauthorizedException('Account no longer exists');

    request.user = user;
    return true;
  }
}
