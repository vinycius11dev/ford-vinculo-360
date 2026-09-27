import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

function requireHttpsOrigin(value: string, name: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTPS origin`);
  }
  if (parsed.protocol !== 'https:' || parsed.origin !== value) {
    throw new Error(`${name} must be an HTTPS origin without path, query, or fragment`);
  }
}

async function bootstrap() {
  const environment = process.env.NODE_ENV;
  if (!['development', 'test', 'production'].includes(environment ?? '')) {
    throw new Error('NODE_ENV must be explicitly set to development, test, or production');
  }
  const production = environment === 'production';
  const httpLogger = new Logger('HTTP');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api/v1');
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isSafeInteger(proxyHops) || proxyHops < 0) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
  }
  if (proxyHops > 0) app.set('trust proxy', proxyHops);

  app.use((request: Request, response: Response, next: NextFunction) => {
    const provided = request.headers['x-request-id'];
    const candidate = Array.isArray(provided) ? provided[0] : provided;
    const requestId = candidate && /^[A-Za-z0-9._:-]{1,80}$/.test(candidate)
      ? candidate
      : randomUUID();
    const startedAt = Date.now();
    response.setHeader('x-request-id', requestId);
    response.on('finish', () => {
      const routePath = request.route?.path;
      const normalizedRoute = Array.isArray(routePath) ? routePath[0] : routePath;
      const path = normalizedRoute
        ? `${normalizedRoute}`.slice(0, 300)
        : request.path === '/health' ? '/health' : '[unmatched]';
      httpLogger.log(JSON.stringify({
        event: 'http.request',
        method: request.method,
        path,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        requestId,
      }));
    });
    next();
  });

  const docsHeaders = helmet({ contentSecurityPolicy: false });
  const apiHeaders = helmet();
  app.use((request: Request, response: Response, next: NextFunction) => {
    const pathname = request.path;
    const middleware = pathname === '/docs' || pathname.startsWith('/docs/')
      ? docsHeaders
      : apiHeaders;
    middleware(request, response, next);
  });

  const localOrigins = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:8081',
    'http://localhost:8081',
  ];
  const configuredOrigins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [];
  if (production) {
    if (!configuredOrigins.length) {
      throw new Error('CORS_ORIGINS must contain the exact HTTPS client origins in production');
    }
    for (const origin of configuredOrigins) requireHttpsOrigin(origin, 'CORS_ORIGINS entry');
    const publicApiOrigin = process.env.PUBLIC_API_ORIGIN?.trim();
    if (!publicApiOrigin) throw new Error('PUBLIC_API_ORIGIN must be set in production');
    requireHttpsOrigin(publicApiOrigin, 'PUBLIC_API_ORIGIN');
  }
  const allowedOrigins = production
    ? configuredOrigins
    : [...new Set([...configuredOrigins, ...localOrigins])];
  // Fotos enviadas pelo catálogo ficam no próprio piloto e são servidas sem
  // depender de imagens hospedadas no site da Ford ou em banco de imagens.
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swagger = new DocumentBuilder()
    .setTitle('Ford Vínculo 360 API')
    .setDescription('API inicial de relacionamento pós-venda baseada no VIN.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  if (!production && process.env.ENABLE_API_DOCS !== 'false') {
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  }

  await app.listen(Number(process.env.PORT ?? 3000), production ? '0.0.0.0' : '127.0.0.1');
}
bootstrap();
