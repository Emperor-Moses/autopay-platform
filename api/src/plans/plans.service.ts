import {
  Injectable, BadRequestException, Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma/prisma.service";
import axios from "axios";
import {
  PlanName, PLAN_PRICING, effectivePlan, getPlanLimits,
} from "./plans.constants";

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get ps() { return this.config.get<string>("PAYSTACK_SECRET_KEY")!; }

  // ── Current plan status + usage ─────────────────────────────────────────
  async getPlanStatus(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where:  { id: userId },
      select: {
        plan: true, planExpiresAt: true,
        cardAuthCode: true, cardEmail: true,
        _count: { select: { schedules: { where: { status: "active" } } } },
      },
    });

    const plan   = effectivePlan(user.plan, user.planExpiresAt);
    const limits = getPlanLimits(plan);

    return {
      plan,
      planExpiresAt:  user.planExpiresAt,
      isExpired:      user.plan !== "free" && effectivePlan(user.plan, user.planExpiresAt) === "free",
      hasCard:        !!user.cardAuthCode,
      limits,
      usage: {
        activeSchedules: user._count.schedules,
        schedulesLeft:   limits.maxSchedules === Infinity
          ? null
          : Math.max(0, limits.maxSchedules - user._count.schedules),
      },
      pricing: PLAN_PRICING,
    };
  }

  // ── Initiate upgrade ─────────────────────────────────────────────────────
  async initiateUpgrade(userId: string, plan: "personal" | "business") {
    const user    = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const pricing = PLAN_PRICING[plan];

    // Already on this plan and not expired → nothing to do
    if (effectivePlan(user.plan, user.planExpiresAt) === plan) {
      throw new BadRequestException(`You are already on the ${plan} plan.`);
    }

    // User already has a linked card — charge it directly, no browser needed
    if (user.cardAuthCode && user.cardEmail) {
      return this.chargeStoredCard(userId, plan, user.cardAuthCode, user.cardEmail);
    }

    // No card yet — open Paystack checkout
    const callbackUrl = this.config.get<string>("PAYSTACK_CALLBACK_URL") ??
      "https://autopay-platform.netlify.app/plan-upgraded";

    const reference = `AUTOPAY-PLAN-${plan.toUpperCase()}-${Date.now()}`;

    const { data } = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email:        user.email,
        amount:       pricing.kobo,
        currency:     "NGN",
        reference,
        callback_url: callbackUrl,
        channels:     ["card"],
        metadata: {
          autopay_action:  "PLAN_UPGRADE",
          autopay_user_id: userId,
          autopay_plan:    plan,
        },
      },
      { headers: { Authorization: `Bearer ${this.ps}` } },
    );

    return {
      method:      "checkout",
      checkoutUrl: data.data.authorization_url,
      reference,
      plan,
      amount:      pricing.naira,
      message:     `Complete payment to upgrade to ${pricing.label}`,
    };
  }

  // ── Charge stored card (background, no redirect) ─────────────────────────
  private async chargeStoredCard(
    userId:   string,
    plan:     "personal" | "business",
    authCode: string,
    email:    string,
  ) {
    const pricing   = PLAN_PRICING[plan];
    const reference = `AUTOPAY-PLAN-${plan.toUpperCase()}-${Date.now()}`;

    try {
      const { data } = await axios.post(
        "https://api.paystack.co/charge/authorize",
        {
          authorization_code: authCode,
          email,
          amount:   pricing.kobo,
          reference,
          metadata: {
            autopay_action:  "PLAN_UPGRADE",
            autopay_user_id: userId,
            autopay_plan:    plan,
          },
        },
        { headers: { Authorization: `Bearer ${this.ps}` } },
      );

      if (data.data.status === "success") {
        await this.activatePlan(userId, plan, reference);
        return {
          method:    "card",
          success:   true,
          plan,
          amount:    pricing.naira,
          reference,
          message:   `✅ Upgraded to ${pricing.label}! Your plan is now active.`,
        };
      }

      return {
        method:  "card",
        success: false,
        pending: true,
        reference,
        message: "Payment is processing — your plan will activate shortly.",
      };

    } catch (err: any) {
      this.logger.error(`Plan charge failed: ${err.message}`);
      throw new BadRequestException("Card charge failed. Please try a different card.");
    }
  }

  // ── Activate plan (called by webhook or direct charge) ───────────────────
  async activatePlan(userId: string, plan: PlanName, reference: string) {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await this.prisma.user.update({
      where: { id: userId },
      data:  { plan, planExpiresAt: expiresAt },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action:   "PLAN_ACTIVATED",
        entity:   "User",
        entityId: userId,
        changes:  { plan, reference, expiresAt },
      },
    });

    await this.prisma.alert.create({
      data: {
        userId,
        type:    "success",
        title:   `🎉 ${PLAN_PRICING[plan as "personal" | "business"]?.label ?? plan} Plan Active`,
        message: `Your plan is active until ${expiresAt.toLocaleDateString("en-NG")}. Enjoy your new features!`,
      },
    });

    this.logger.log(`Plan activated: user=${userId} plan=${plan} expires=${expiresAt.toISOString()}`);
    return { plan, expiresAt };
  }

  // ── Cancel (stays active until expiry) ───────────────────────────────────
  async cancelPlan(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where:  { id: userId },
      select: { plan: true, planExpiresAt: true },
    });

    if (!user.plan || user.plan === "free") {
      throw new BadRequestException("You are already on the free plan.");
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action:   "PLAN_CANCELLED",
        entity:   "User",
        entityId: userId,
        changes:  { plan: user.plan, expiresAt: user.planExpiresAt },
      },
    });

    await this.prisma.alert.create({
      data: {
        userId,
        type:    "info",
        title:   "Plan Cancelled",
        message: `Your plan stays active until ${user.planExpiresAt?.toLocaleDateString("en-NG")}. After that your account reverts to Free.`,
      },
    });

    return {
      message:   `Cancelled. Your plan remains active until ${user.planExpiresAt?.toLocaleDateString("en-NG")}.`,
      expiresAt: user.planExpiresAt,
    };
  }
}
