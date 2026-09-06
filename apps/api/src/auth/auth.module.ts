import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AvatarsController } from './avatars.controller.js';
import { AvatarsService } from './avatars.service.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.accessSecret,
        signOptions: { expiresIn: config.accessTokenTtl },
      }),
    }),
  ],
  controllers: [AuthController, AvatarsController],
  providers: [AuthService, AvatarsService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
