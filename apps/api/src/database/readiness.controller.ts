import { Controller, Get, Header, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

@Controller('health/ready')
export class ReadinessController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async getReadiness() {
    if (!(await this.database.isReady())) {
      throw new ServiceUnavailableException({ status: 'unavailable', service: 'devflow-api' });
    }
    return { status: 'ready', service: 'devflow-api' };
  }
}
