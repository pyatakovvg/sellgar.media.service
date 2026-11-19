import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { FileMetadataEntity } from './file-metadata.entity';

@Injectable()
export class FileMetadataGateway {
  constructor(@Inject('FILE_SERVICE') private readonly fileService: ClientProxy) {}

  findByUuid(uuid: string) {
    return firstValueFrom(this.fileService.send<FileMetadataEntity>({ cmd: 'file.getByUuid' }, { uuid }));
  }
}
