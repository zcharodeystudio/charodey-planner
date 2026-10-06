import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Model } from 'mongoose';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshSession } from './refresh-session.schema';
import { User } from './user.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(RefreshSession.name) private readonly sessionModel: Model<RefreshSession>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.userModel.findOne({ email }).select('_id').lean().exec();
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже есть');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userModel.create({
      email,
      name: dto.name.trim(),
      passwordHash,
    });
    return this.issueTokens(user.id, user.email, user.name);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userModel.findOne({ email }).exec();
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    return this.issueTokens(user.id, user.email, user.name);
  }

  async refreshSession(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.sessionModel.findOne({ tokenHash }).exec();
    if (!session || session.expiresAt.getTime() < Date.now()) {
      if (session) await session.deleteOne();
      throw new UnauthorizedException('Сессия истекла');
    }

    const user = await this.userModel.findById(session.userId).exec();
    if (!user) {
      await session.deleteOne();
      throw new UnauthorizedException('Сессия истекла');
    }

    await session.deleteOne();
    return this.issueTokens(user.id, user.email, user.name);
  }

  async revokeSession(refreshToken: string) {
    await this.sessionModel.deleteOne({ tokenHash: this.hashToken(refreshToken) }).exec();
    return { ok: true };
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).select('email name').exec();
    if (!user) {
      throw new UnauthorizedException('Сессия истекла');
    }
    return { id: user.id, email: user.email, name: user.name };
  }

  private async issueTokens(id: string, email: string, name: string) {
    const accessToken = await this.jwtService.signAsync({ sub: id, email, name });
    const refreshToken = randomBytes(48).toString('hex');
    const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 180);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.sessionModel.create({
      userId: id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt,
    });
    return {
      accessToken,
      refreshToken,
      user: { id, email, name },
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
