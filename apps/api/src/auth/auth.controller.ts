import { Body, Controller, Get, Headers, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { ZodPipe } from '../common/zod.pipe.js';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { AuthService, type AuthResult } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from './auth.dto.js';
import type { AuthUser } from './auth.types.js';

export const REFRESH_COOKIE = 'sp_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body(new ZodPipe(registerSchema)) body: RegisterInput,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respond(await this.auth.register(body, userAgent), response);
  }

  @Public()
  @Post('login')
  async login(
    @Body(new ZodPipe(loginSchema)) body: LoginInput,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respond(await this.auth.login(body, userAgent), response);
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = this.readCookie(request);
    if (token === undefined) {
      response.status(401);
      return { message: 'No session' };
    }
    return this.respond(await this.auth.refresh(token, userAgent), response);
  }

  @Public()
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(this.readCookie(request));
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions(new Date(0)));
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): { user: AuthUser } {
    return { user };
  }

  /** Which sign-in methods this instance actually has configured. */
  @Public()
  @Get('providers')
  providers() {
    return {
      password: true,
      registration: this.config.allowRegistration,
      github: this.config.oauth.github !== null,
      google: this.config.oauth.google !== null,
    };
  }

  private respond(result: AuthResult, response: Response) {
    response.cookie(
      REFRESH_COOKIE,
      result.refreshToken,
      this.cookieOptions(result.refreshExpiresAt),
    );
    return { user: result.user, accessToken: result.accessToken };
  }

  private readCookie(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[REFRESH_COOKIE];
  }

  /**
   * The refresh token is httpOnly so page scripts cannot read it; the access
   * token is short-lived and kept in memory by the client instead.
   */
  private cookieOptions(expires: Date) {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: this.config.cookieSecure ? ('none' as const) : ('lax' as const),
      path: '/',
      expires,
      ...(this.config.cookieDomain !== undefined && { domain: this.config.cookieDomain }),
    };
  }
}
