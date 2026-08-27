import {
  Controller, Get, Patch, Post, Delete, Body, Param, UseGuards, Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard }       from "../auth/jwt-auth.guard";
import { UsersService }       from "./users.service";
import { UpdateProfileDto }   from "./dto/update-profile.dto";
import { UpdateSettingsDto }  from "./dto/update-settings.dto";
import { ChangePasswordDto }  from "./dto/change-password.dto";
import { LinkBankDto }        from "./dto/link-bank.dto";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  getMe(@Req() req: any) {
    return this.users.getProfile(req.user.id);
  }

  @Patch("me")
  updateMe(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(req.user.id, dto);
  }

  @Patch("me/settings")
  updateSettings(@Req() req: any, @Body() dto: UpdateSettingsDto) {
    return this.users.updateSettings(req.user.id, dto);
  }

  @Patch("me/password")
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
  }

  @Delete("me")
  deleteMe(@Req() req: any) {
    return this.users.deleteAccount(req.user.id);
  }

  // ── Bank accounts ─────────────────────────────────────────────────────────
  @Get("me/bank-accounts")
  getBankAccounts(@Req() req: any) {
    return this.users.getLinkedAccounts(req.user.id);
  }

  @Post("me/bank-accounts")
  linkBank(@Req() req: any, @Body() dto: LinkBankDto) {
    return this.users.linkBankAccount(req.user.id, dto);
  }

  @Patch("me/bank-accounts/:id/default")
  setDefault(@Req() req: any, @Param("id") id: string) {
    return this.users.setDefaultAccount(req.user.id, id);
  }

  @Delete("me/bank-accounts/:id")
  unlinkBank(@Req() req: any, @Param("id") id: string) {
    return this.users.unlinkBankAccount(req.user.id, id);
  }

  // ── Direct Debit mandate ─────────────────────────────────────────────────
  @Post("me/bank-accounts/:id/direct-debit/initialize")
  initializeDirectDebit(@Req() req: any, @Param("id") id: string) {
    return this.users.initializeDirectDebit(req.user.id, id);
  }

  @Get("me/bank-accounts/:id/direct-debit/status")
  getDirectDebitStatus(@Req() req: any, @Param("id") id: string) {
    return this.users.checkDirectDebitStatus(req.user.id, id);
  }

  // ── Paystack customer ─────────────────────────────────────────────────────
  @Post("me/paystack-customer")
  ensureCustomer(@Req() req: any) {
    return this.users.ensurePaystackCustomer(req.user.id);
  }
}
