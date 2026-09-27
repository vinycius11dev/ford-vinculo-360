import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MessagingModule } from '../messaging/messaging.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    PassportModule,
    MessagingModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('JWT_SECRET');
        if (
          config.get('NODE_ENV') === 'production' &&
          (Buffer.byteLength(secret, 'utf8') < 32 ||
            secret === 'substitua-por-um-segredo-longo-antes-de-produzir')
        ) {
          throw new Error('JWT_SECRET must be a generated secret of at least 32 bytes in production');
        }
        return { secret, signOptions: { expiresIn: '15m' } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard],
  exports: [JwtModule, RolesGuard],
})
export class AuthModule {}
