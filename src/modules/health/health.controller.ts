import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'down',
      });
    }
    return { status: 'ok', db: 'up' };
  }
}
