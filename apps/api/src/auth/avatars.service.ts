import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { PrismaService } from '../common/prisma.service.js';
import { APP_CONFIG, type AppConfig } from '../config/env.js';

/** The first eight bytes of every PNG. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const NAME = /^[0-9a-f]{32}\.png$/;

/**
 * Avatars, stored as files rather than in the database: they are served on
 * nearly every screen and never joined against.
 *
 * Only PNG is accepted, because the browser draws the finished square onto a
 * canvas and hands over what it produced. That keeps the server out of the
 * image-decoding business entirely — there is nothing here to be exploited by a
 * malformed JPEG, and no native dependency to build.
 */
@Injectable()
export class AvatarsService {
  private readonly dir: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.dir = resolve(config.uploads.dir, 'avatars');
  }

  async replace(userId: string, body: Buffer): Promise<{ avatarUrl: string }> {
    if (body.length === 0) throw new BadRequestException('No image was sent');
    if (body.length > this.config.uploads.avatarMaxBytes) {
      throw new BadRequestException('That image is too large');
    }
    if (!body.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      throw new BadRequestException('Only PNG is accepted');
    }

    const name = `${randomBytes(16).toString('hex')}.png`;
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, name), body);

    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    const avatarUrl = `/api/avatars/${name}`;
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    await this.discard(previous?.avatarUrl ?? null);
    return { avatarUrl };
  }

  async remove(userId: string): Promise<{ ok: true }> {
    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    await this.discard(previous?.avatarUrl ?? null);
    return { ok: true };
  }

  /** Reads one stored avatar. The name is checked rather than trusted. */
  async read(name: string): Promise<Buffer | null> {
    if (!NAME.test(name)) return null;
    return readFile(join(this.dir, name)).catch(() => null);
  }

  private async discard(avatarUrl: string | null): Promise<void> {
    const name = avatarUrl?.split('/').pop();
    if (name === undefined || !NAME.test(name)) return;
    await rm(join(this.dir, name), { force: true }).catch(() => undefined);
  }
}
