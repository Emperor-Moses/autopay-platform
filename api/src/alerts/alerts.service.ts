import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, unreadOnly = false) {
    return this.prisma.alert.findMany({
      where:   { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: "desc" },
      take:    50,
    });
  }

  async markRead(userId: string, id: string) {
    const alert = await this.prisma.alert.findFirst({ where: { id, userId } });
    if (!alert) throw new NotFoundException("Alert not found");
    return this.prisma.alert.update({ where: { id }, data: { isRead: true, readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    await this.prisma.alert.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    });
    return { message: "All alerts marked as read" };
  }

  async deleteAlert(userId: string, id: string) {
    const alert = await this.prisma.alert.findFirst({ where: { id, userId } });
    if (!alert) throw new NotFoundException("Alert not found");
    await this.prisma.alert.delete({ where: { id } });
    return { message: "Alert deleted" };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.alert.count({ where: { userId, isRead: false } });
    return { count };
  }
}
