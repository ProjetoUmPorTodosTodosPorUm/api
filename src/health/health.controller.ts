import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/utils';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) { }

  @ApiResponse({
    schema: {
      type: 'string',
      default: 'ok'
    }
  })
  @Public()
  @Get()
  healthCheck() {
    return this.healthService.healthCheck();
  }
}
