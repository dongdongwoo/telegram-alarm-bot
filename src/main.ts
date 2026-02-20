import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Telegram Notification Bot API')
    .setDescription('텔레그램 알림봇 API - 메시지 전송 및 봇 명령어 관리')
    .setVersion('1.0')
    .addTag('notification', '알림 메시지 즉시 전송')
    .addTag('schedule', '알림 스케줄 관리 (고정 반복 / 수동 일회성)')
    .addTag('bot', '봇 상태 및 정보')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🚀 Server is running on http://localhost:${port}`);
  console.log(`📖 Swagger docs: http://localhost:${port}/api`);
}

void bootstrap();
