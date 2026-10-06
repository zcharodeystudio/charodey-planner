import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class AppService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  getHello() {
    return { service: 'charodey-planner-api' };
  }

  getHealth() {
    const connected = this.connection.readyState === 1;
    if (!connected) {
      throw new ServiceUnavailableException({
        status: 'error',
        mongo: 'disconnected',
      });
    }
    return { status: 'ok', mongo: 'connected' };
  }
}
