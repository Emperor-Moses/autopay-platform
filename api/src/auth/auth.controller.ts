import {
  Controller, Post, Body, Req, HttpCode, HttpStatus, UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength }         from "class-validator";
import { JwtAuthGuard }   from "./jwt-auth.guard";
import { AuthService }    from "./auth.service";
import { RegisterDto }    from "./dto/register.dto";
import { LoginDto }       from "./dto/login.dto";

// ── DTOs ──────────────────────────────────────────────────────────────────
class RefreshDto       { @IsString() refreshToken: string; }
class SetPinDto        { @IsString() pin: string; }
class VerifyPinDto     { @IsString() pin: string; }
class ForgotPasswordDto {
  @IsEmail()
  email: string;
}
class ResetPasswordDto {
  @IsEmail()
  email: string;
  @IsString()
  token: string;
  @IsString() @MinLength(8)
  newPassword: string;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Create a new account" })
  register(@Body() dto: RegisterDto, @Req() req: any) {
    return this.auth.register(dto, req.ip);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Sign in and receive tokens" })
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.auth.login(dto, req.ip);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token using refresh token" })
  refresh(@Body() dto: RefreshDto, @Req() req: any) {
    return this.auth.refresh(dto.refreshToken, req.ip);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke refresh token" })
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  // ── Forgot / Reset password ──────────────────────────────────────────────

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request a password reset email" })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset password using token from email" })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.email, dto.token, dto.newPassword);
  }

  // ── PIN ───────────────────────────────────────────────────────────────────

  @Post("pin")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Set or update account PIN" })
  setPin(@Req() req: any, @Body() dto: SetPinDto) {
    return this.auth.setPin(req.user.id, dto.pin);
  }

  @Post("pin/verify")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify account PIN" })
  verifyPin(@Req() req: any, @Body() dto: VerifyPinDto) {
    return this.auth.verifyPin(req.user.id, dto.pin);
  }
}
