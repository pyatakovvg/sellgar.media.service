import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';

import { ImagesService } from './images.service';

@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Get(':fileUuid')
  async getByFileUuid(@Param('fileUuid') fileUuid: string, @Res() res: Response) {
    const result = await this.imagesService.getByFileUuid(fileUuid);

    res.header('Content-Type', result.file.mime);
    res.header('Cache-Control', 'public, max-age=31536000, immutable');
    res.header('X-File-Uuid', result.file.uuid);

    result.stream.pipe(res);
  }
}
