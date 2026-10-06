import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';

@SkipThrottle()
@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOkResponse({ description: 'API and MongoDB are reachable' })
  @ApiServiceUnavailableResponse({ description: 'MongoDB is not connected' })
  getHealth() {
    return this.appService.getHealth();
  }
}
