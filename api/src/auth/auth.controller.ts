import {
  Controller, Post, Body, Req, UseGuards, HttpCode, HttpStatus, Get,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { Request } from "express";
import { AuthService }                        from "./auth.service";
import { JwtAuthGuard }                       from "./jwt-auth.guard";
import { RegisterDto }                        from "./dto/register.dto";
import { LoginDto, RefreshTokenDto, SetPinDto, VerifyPinDto } from "./dto/auth.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register a new user" })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login and receive JWT tokens" })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket?.remoteAddress;
    return this.auth.login(dto, ip);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token" })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout (revoke session)" })
  logout(@Req() req: any, @Body() body: { refreshToken?: string }) {
    return this.auth.logout(req.user.id, body.refreshToken);
  }

  @Post("pin")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Set or update 4-digit PIN" })
  setPin(@Req() req: any, @Body() dto: SetPinDto) {
    return this.auth.setPin(req.user.id, dto);
  }

  @Post("pin/verify")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Verify PIN before a sensitive action" })
  verifyPin(@Req() req: any, @Body() dto: VerifyPinDto) {
    return this.auth.verifyPin(req.user.id, dto);
  }
}
