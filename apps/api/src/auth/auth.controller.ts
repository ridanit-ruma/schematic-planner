import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { StrictRateLimit } from '../common/throttle.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { AuthService, type AuthResult } from './auth.service.js';
import { AvatarsService } from './avatars.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';
import {
  changePasswordSchema,
  createApiKeySchema,
  deleteAccountSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type CreateApiKeyInput,
  type DeleteAccountInput,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
} from './auth.dto.js';
import type { AuthUser } from './auth.types.js';

export const REFRESH_COOKIE = 'sp_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly avatars: AvatarsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * The finished square, drawn by the browser and sent as PNG bytes. Cropping
   * and scaling happen there, so nothing here has to decode an image.
   */
  @Post('me/avatar')
  async setAvatar(@CurrentUser() user: AuthUser, @Req() request: Request) {
    return this.avatars.replace(user.id, request.body as Buffer);
  }

  @Delete('me/avatar')
  clearAvatar(@CurrentUser() user: AuthUser) {
    return this.avatars.remove(user.id);
  }

  @Public()
  @StrictRateLimit()
  @Post('register')
  async register(
    @Body(new ZodPipe(registerSchema)) body: RegisterInput,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respond(await this.auth.register(body, userAgent), response);
  }

  @Public()
  @StrictRateLimit()
  @Post('login')
  async login(
    @Body(new ZodPipe(loginSchema)) body: LoginInput,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respond(await this.auth.login(body, userAgent), response);
  }

  @Public()
  @StrictRateLimit()
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

  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return this.auth.updateProfile(user.id, body);
  }

  @StrictRateLimit()
  @Post('password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
    @Body(new ZodPipe(changePasswordSchema)) body: ChangePasswordInput,
  ) {
    // The session making the change is kept; every other one is ended.
    return this.auth.changePassword(user.id, body, this.readCookie(request));
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser, @Req() request: Request) {
    return this.auth.sessions(user.id, this.readCookie(request));
  }

  @Delete('sessions/:id')
  revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.auth.revokeSession(user.id, id);
  }

  @Delete('sessions')
  revokeOthers(@CurrentUser() user: AuthUser, @Req() request: Request) {
    return this.auth.revokeOtherSessions(user.id, this.readCookie(request));
  }

  @StrictRateLimit()
  @Delete('me')
  async deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(deleteAccountSchema)) body: DeleteAccountInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.deleteAccount(user.id, body.password);
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions(new Date(0)));
    return result;
  }

  /**
   * Keys live with the account rather than a workspace: one key reaches every
   * workspace its owner belongs to.
   */
  @Get('api-keys')
  apiKeys(@CurrentUser() user: AuthUser) {
    return this.auth.listApiKeys(user.id);
  }

  @Post('api-keys')
  createApiKey(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createApiKeySchema)) body: CreateApiKeyInput,
  ) {
    return this.auth.createApiKey(user.id, body);
  }

  @Delete('api-keys/:id')
  revokeApiKey(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.auth.revokeApiKey(user.id, id);
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
