import { Module } from '@nestjs/common';
import { QueueGateway } from './queue/queue.gateway';
import { PrismaService } from './lib/prisma.service';
import { SubscriptionsController } from './subscriptions/subscriptions.controller';

@Module({
  providers: [QueueGateway, PrismaService],
  controllers: [SubscriptionsController],
})
export class AppModule {}
