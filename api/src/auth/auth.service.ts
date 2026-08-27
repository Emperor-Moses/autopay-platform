import {
  Injectable, UnauthorizedException, ConflictException,
  BadRequestException, NotFoundException,
} from "@nestjs/common";
import { JwtService }    from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt       from "bcrypt";
import { v4 as uuid }   from "uuid";

import { PrismaService } from "../common/prisma/prisma.service";
import { RegisterDto }   from "./dto/register.dto";
import { LoginDto }      from "./dto/login.dto";
import { SetPinDto }     from "./dto/set-pin.dto";
import { VerifyPinDto }  from "./dto/verify-pin.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma:  PrismaService,
    private readonly jwt:     JwtService,
    private readonly config:  ConfigService,
  ) {}

  // ── Register ───────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException("Email already registered");

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name:         dto.name,
        email:        dto.email.toLowerCase().trim(),
        passwordHash,
        phone:        dto.phone,
        plan:         "personal",
        betaAccess:   true,
      },
      select: { id: true, name: true, email: true, plan: true, createdAt: true },
    });

    // Log audit
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "REGISTER", entity: "User", entityId: user.id },
    });

    // Welcome alert
    await this.prisma.alert.create({
      data: {
        userId:  user.id,
        type:    "info",
        title:   "🎉 Welcome to AutoPay Beta",
        message: "Your account is set up. You have 3 months of Personal plan free.",
      },
    });

    const tokens = await this.issueTokens(user.id);
    return { user: { ...user, hasPin: false }, ...tokens };
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Incorrect email or password");
    }

    if (user.deletedAt) throw new UnauthorizedException("Account is deactivated");

    await this.prisma.user.update({
      where: { id: user.id },
      data:  { lastLoginAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "LOGIN", ipAddress },
    });

    const tokens = await this.issueTokens(user.id, ipAddress, dto.deviceInfo);
    const { passwordHash, pin, ...safeUser } = user;
    return { user: { ...safeUser, hasPin: !!pin }, ...tokens };
  }

  // ── Refresh token ──────────────────────────────────────────────────────────
  async refresh(refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    // Rotate refresh token
    await this.prisma.session.update({
      where: { id: session.id },
      data:  { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(session.userId);
    return tokens;
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.session.updateMany({
        where: { userId, refreshToken },
        data:  { revokedAt: new Date() },
      });
    } else {
      // Revoke all sessions for user
      await this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data:  { revokedAt: new Date() },
      });
    }
  }

  // ── PIN management ─────────────────────────────────────────────────────────
  async setPin(userId: string, dto: SetPinDto) {
    if (!/^\d{4}$/.test(dto.pin)) throw new BadRequestException("PIN must be exactly 4 digits");

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    // Require current password to change PIN (security gate)
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException("Incorrect password");
    }

    const pinHash = await bcrypt.hash(dto.pin, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { pin: pinHash } });
    await this.prisma.auditLog.create({
      data: { userId, action: "SET_PIN" },
    });
    return { message: "PIN updated successfully" };
  }

  async verifyPin(userId: string, dto: VerifyPinDto): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.pin) throw new BadRequestException("No PIN set. Please set a PIN first.");
    return bcrypt.compare(dto.pin, user.pin);
  }

  // ── Internal ───────────────────────────────────────────────────────────────
  private async issueTokens(userId: string, ipAddress?: string, deviceInfo?: string) {
    const accessToken  = this.jwt.sign({ sub: userId });
    const refreshToken = uuid();
    const expiresIn    = this.config.get("JWT_REFRESH_EXPIRES_IN", "30d");
    const days         = parseInt(expiresIn);
    const expiresAt    = new Date(Date.now() + days * 86400000);

    await this.prisma.session.create({
      data: { userId, refreshToken, expiresAt, ipAddress, deviceInfo },
    });

    return { accessToken, refreshToken };
  }
}
