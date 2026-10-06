import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationError } from 'class-validator';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getJwtSecret } from './config/jwt-secret';

async function bootstrap() {
  getJwtSecret();

  const isProd = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    logger: isProd ? ['error', 'warn', 'log'] : undefined,
  });
  app.enableShutdownHooks();

  if (process.env.TRUST_PROXY === '1' || process.env.RENDER === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map((item) => item.trim()) ?? (isProd ? false : true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));
        return new BadRequestException({
          message: messages,
          error: 'Bad Request',
          statusCode: 400,
        });
      },
    }),
  );

  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle('Charodey Planner API')
      .setDescription('Задачи, напоминания и аккаунты')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
