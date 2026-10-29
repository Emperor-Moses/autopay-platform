import {
  Injectable, UnauthorizedException, BadRequestException,
  ConflictException, Logger,
} from "@nestjs/common";
import { JwtService }       from "@nestjs/jwt";
import { ConfigService }    from "@nestjs/config";
import { PrismaService }    from "../common/prisma/prisma.service";
import * as bcrypt          from "bcrypt";
import * as crypto          from "crypto";
import * as nodemailer      from "nodemailer";
import { RegisterDto }      from "./dto/register.dto";
import { LoginDto }         from "./dto/login.dto";

const RESET_EXPIRY_MINUTES = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly jwt:     JwtService,
    private readonly config:  ConfigService,
  ) {}

  private get mailer() {
    return nodemailer.createTransport({
      host:   this.config.get("SMTP_HOST"),
      port:   Number(this.config.get("SMTP_PORT", "587")),
      secure: this.config.get("SMTP_SECURE", "false") === "true",
      auth: {
        user: this.config.get("SMTP_USER"),
        pass: this.config.get("SMTP_PASS"),
      },
    });
  }

  private get appUrl() {
    return this.config.get("APP_URL", "https://auto-pay.com.ng");
  }

  private get fromEmail() {
    return this.config.get("SMTP_FROM", "AutoPay <noreply@auto-pay.com.ng>");
  }

  async register(dto: RegisterDto, ipAddress?: string) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) throw new ConflictException("An account with this email already exists.");
    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email.toLowerCase(), phone: dto.phone, passwordHash: hash, plan: "free" },
    });
    const tokens = await this.issueTokens(user.id, ipAddress);
    const { passwordHash, pin, ...safe } = user as any;
    return { user: { ...safe, hasPin: false }, ...tokens };
  }

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Incorrect email or password.");
    }
    if (user.deletedAt) throw new UnauthorizedException("This account has been deactivated.");
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.issueTokens(user.id, ipAddress);
    const { passwordHash, pin, ...safe } = user as any;
    return { user: { ...safe, hasPin: !!pin }, ...tokens };
  }

  async refresh(refreshToken: string, ipAddress?: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken }, include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }
    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    const tokens = await this.issueTokens(session.userId, ipAddress);
    const { passwordHash, pin, ...safe } = session.user as any;
    return { user: { ...safe, hasPin: !!pin }, ...tokens };
  }

  async logout(refreshToken: string) {
    await this.prisma.session.updateMany({ where: { refreshToken }, data: { revokedAt: new Date() } });
    return { message: "Logged out" };
  }

  async forgotPassword(email: string) {
    const genericMessage = "If an account exists for this email, a reset link has been sent.";
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.deletedAt) return { message: genericMessage };

    const token     = crypto.randomBytes(32).toString("hex");
    const expiry    = new Date(Date.now() + RESET_EXPIRY_MINUTES * 60 * 1000);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await this.prisma.user.update({
      where: { id: user.id },
      data:  { passwordResetToken: tokenHash, passwordResetExpiry: expiry },
    });

    const resetUrl = `${this.appUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    try {
      await this.mailer.sendMail({
        from:    this.fromEmail,
        to:      user.email,
        subject: "Reset your AutoPay password",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#0f1a0f;padding:24px 32px">
              <span style="font-family:Georgia,serif;font-size:22px;color:#eef5ee">Auto</span>
              <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;font-style:italic;color:#2edc72">Pay</span>
            </div>
            <div style="background:#fff;padding:32px">
              <h2 style="color:#0f1a0f;margin:0 0 16px">Reset your password</h2>
              <p style="color:#2a3a2a;line-height:1.7;margin:0 0 16px">
                Hi ${user.name.split(" ")[0]}, we received a request to reset your AutoPay password.
              </p>
              <p style="color:#2a3a2a;line-height:1.7;margin:0 0 28px">
                This link expires in <strong>${RESET_EXPIRY_MINUTES} minutes</strong>.
              </p>
              <a href="${resetUrl}" style="background:#1a6641;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">
                Reset my password →
              </a>
              <p style="color:#9ab09a;font-size:13px;margin-top:24px">
                If you didn't request this, ignore this email — your password won't change.
              </p>
            </div>
            <div style="background:#0f1a0f;padding:16px 32px;text-align:center">
              <p style="color:#3a5a3a;font-size:11px;margin:0">AutoPay Platform Ltd · Port Harcourt, Nigeria</p>
            </div>
          </div>
        `,
      });
      this.logger.log(`Password reset email sent to ${user.email}`);
    } catch (err) {
      this.logger.error(`Failed to send reset email: ${err.message}`);
    }

    return { message: genericMessage };
  }

  async resetPassword(email: string, token: string, newPassword: string) {
    if (newPassword.length < 8) throw new BadRequestException("Password must be at least 8 characters.");

    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.passwordResetToken || !user.passwordResetExpiry) {
      throw new BadRequestException("This reset link is invalid or has already been used.");
    }
    if (user.passwordResetExpiry < new Date()) {
      throw new BadRequestException("This reset link has expired. Please request a new one.");
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    if (tokenHash !== user.passwordResetToken) {
      throw new BadRequestException("This reset link is invalid or has already been used.");
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data:  { passwordHash: newHash, passwordResetToken: null, passwordResetExpiry: null },
    });
    await this.prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
    await this.prisma.auditLog.create({ data: { userId: user.id, action: "PASSWORD_RESET" } });
    return { message: "Password reset successfully. Please sign in with your new password." };
  }

  async setPin(userId: string, pin: string) {
    if (!/^\d{4,6}$/.test(pin)) throw new BadRequestException("PIN must be 4–6 digits.");
    const hash = await bcrypt.hash(pin, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { pin: hash } });
    return { message: "PIN set" };
  }

  async verifyPin(userId: string, pin: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.pin) throw new BadRequestException("No PIN set on this account.");
    if (!(await bcrypt.compare(pin, user.pin))) throw new UnauthorizedException("Incorrect PIN.");
    return { ok: true };
  }

  private async issueTokens(userId: string, ipAddress?: string) {
    const accessToken   = this.jwt.sign({ sub: userId });
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 30);
    const refreshToken = crypto.randomBytes(40).toString("hex");
    await this.prisma.session.create({
      data: { userId, refreshToken, expiresAt: refreshExpiry, ipAddress: ipAddress ?? null },
    });
    return { accessToken, refreshToken };
  }
}
