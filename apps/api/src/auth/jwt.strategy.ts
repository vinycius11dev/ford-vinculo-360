import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: config.getOrThrow<string>('JWT_SECRET') });
  }

  async validate(payload: AuthenticatedUser & { sub: string }) {
    const session = payload.sessionId
      ? await this.prisma.authSession.findUnique({
          where: { id: payload.sessionId },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                dealershipId: true,
                active: true,
                sessionVersion: true,
              },
            },
          },
        })
      : null;
    const user = session?.user;
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !user?.active ||
      user.id !== payload.sub ||
      user.sessionVersion !== payload.sessionVersion
    )
      throw new UnauthorizedException('Sessão expirada ou revogada.');
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      dealershipId: user.dealershipId,
      sessionVersion: user.sessionVersion,
      sessionId: session.id,
    } satisfies AuthenticatedUser;
  }
}
