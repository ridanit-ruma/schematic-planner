import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from './public.decorator.js';
import { AvatarsService } from './avatars.service.js';

/**
 * Serves stored avatars. Public, because a picture appears wherever its owner
 * does — a member list, a comment, a cursor — and gating it would mean a token
 * on every image request.
 */
@Controller('avatars')
export class AvatarsController {
  constructor(private readonly avatars: AvatarsService) {}

  @Public()
  @Get(':name')
  async read(@Param('name') name: string, @Res() response: Response): Promise<void> {
    const file = await this.avatars.read(name);
    if (file === null) throw new NotFoundException('No such image');

    // The type is stated rather than guessed, and sniffing is refused: the
    // bytes were accepted as PNG and must never be interpreted as anything else.
    response.setHeader('Content-Type', 'image/png');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    // The name is new on every upload, so a stored file never changes.
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.end(file);
  }
}
