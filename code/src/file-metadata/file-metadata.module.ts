import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { FileMetadataGateway } from './file-metadata.gateway';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'FILE_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              {
                protocol: 'amqp',
                hostname: config.get('AMQP_HOSTNAME'),
                port: config.get('AMQP_PORT'),
                username: config.get('AMQP_USERNAME'),
                password: config.get('AMQP_PASSWORD'),
              },
            ],
            queue: config.get('AMQP_FILE_SRV_COMMAND_QUEUE'),
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),
  ],
  providers: [FileMetadataGateway],
  exports: [FileMetadataGateway],
})
export class FileMetadataModule {}
