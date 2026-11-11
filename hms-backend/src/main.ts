import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Without this, none of the three frontends (staff console, patient
  // portal, platform admin) can call this API from a browser at all -
  // they run on different ports/origins (5173/5174/5175 in dev), and
  // browsers block cross-origin requests by default. CORS_ORIGINS lets
  // production deployments lock this down to real domains instead of
  // the dev port list below.
  const defaultDevOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];
  const configuredOrigins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim());
  app.enableCors({
    origin: configuredOrigins ?? defaultDevOrigins,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // NOTE: RolesGuard must NOT be registered globally. Nest runs global
  // guards before controller-level guards, so a global RolesGuard would
  // evaluate @Roles metadata before JwtAuthGuard has populated req.user
  // - turning every role-protected route into a blanket 403. Instead,
  // every protected controller applies @UseGuards(JwtAuthGuard,
  // RolesGuard) itself (auth first, then role check). Public routes
  // (/auth/login, /auth/register) apply no guards.

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`HMS backend listening on port ${port}`);
}

bootstrap();
