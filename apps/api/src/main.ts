import 'reflect-metadata';

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { APP_CONFIG, type AppConfig } from './config/env.js';

/** The repository keeps one .env at its root; a container gets real env vars. */
function loadDotEnv(): void {
  for (const candidate of ['../../.env', '.env']) {
    const path = resolve(process.cwd(), candidate);
    if (existsSync(path)) process.loadEnvFile(path);
  }
}

async function bootstrap(): Promise<void> {
  loadDotEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get<AppConfig>(APP_CONFIG);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  // The one route that carries bytes rather than JSON. The parser is scoped to
  // it so nothing else in the API can be handed a buffer by accident.
  app.use(
    '/auth/me/avatar',
    express.raw({ type: 'image/png', limit: config.uploads.avatarMaxBytes }),
  );

  app.enableCors({
    origin: [...config.corsOrigins],
    credentials: true,
  });

  if (config.trustProxy) app.set('trust proxy', 1);

  // Finishes in-flight requests and flushes collaborative documents on SIGTERM
  // instead of dropping them.
  app.enableShutdownHooks();

  await app.listen(config.port, config.host);

  const logger = new Logger('bootstrap');
  logger.log(`listening on http://${config.host}:${config.port} (${config.nodeEnv})`);
  logger.log(`public url ${config.apiPublicUrl}, app at ${config.appPublicUrl}`);
}

void bootstrap();
