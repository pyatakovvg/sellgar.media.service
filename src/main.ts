import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger();
  const app: NestExpressApplication = await NestFactory.create(AppModule);
  const config = app.get<ConfigService>(ConfigService);
  const origins = config.get<string>('ORIGINS')?.split(';') ?? [];
  const port = config.get<number>('PORT');

  app.enableCors({
    credentials: false,
    origin: origins,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [
        {
          port: config.get('AMQP_PORT'),
          hostname: config.get('AMQP_HOSTNAME'),
          username: config.get('AMQP_USERNAME'),
          password: config.get('AMQP_PASSWORD'),
        },
      ],
      persistent: true,
      queue: config.get('AMQP_MEDIA_SRV_COMMAND_QUEUE'),
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.startAllMicroservices();

  await app.listen(port, () => {
    logger.log('Media service has been started on port ' + port);
  });
}

bootstrap();
