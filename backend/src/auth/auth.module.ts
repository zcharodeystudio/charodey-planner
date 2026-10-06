import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { getJwtSecret } from '../config/jwt-secret';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RefreshSession, RefreshSessionSchema } from './refresh-session.schema';
import { User, UserSchema } from './user.schema';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: {
        algorithm: 'HS256',
        expiresIn: Number(process.env.JWT_EXPIRES_IN ?? 900),
      },
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefreshSession.name, schema: RefreshSessionSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
