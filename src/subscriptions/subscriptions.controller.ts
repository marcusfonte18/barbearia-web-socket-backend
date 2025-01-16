import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { PrismaService } from 'src/lib/prisma.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private prisma: PrismaService) {}

  @Get(':id')
  async findOne(@Param() { id }: { id: string }) {
    console.log(id);

    const result = await this.prisma.pushSubscription.findMany({
      where: { userId: id },
    });

    return result;
  }

  @Post()
  async create(@Body() createSubscription) {
    const serializedSub = JSON.parse(
      JSON.stringify(createSubscription.subscription),
    );
    await this.prisma.pushSubscription.create({
      data: {
        endpoint: serializedSub.endpoint,
        expiration: serializedSub.expirationTime,
        p256dh: serializedSub.keys.p256dh,
        auth: serializedSub.keys.auth,
        userId: createSubscription.userId,
      },
    });

    return 'Subscriptions API is running!';
  }

  @Delete()
  async delete(@Body() deleteSubscription) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId: deleteSubscription.userId },
    });

    return 'All subscriptions for user deleted!';
  }
}
