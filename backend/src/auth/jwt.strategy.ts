import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtSecret } from '../config/jwt-secret';
import { User } from './user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: { sub: string; email: string; name: string }) {
    const user = await this.userModel.findById(payload.sub).select('email name').exec();
    if (!user) {
      throw new UnauthorizedException('Сессия истекла');
    }
    return { id: user.id, email: user.email, name: user.name };
  }
}
