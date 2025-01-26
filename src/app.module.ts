import { Module } from '@nestjs/common';
import { QueueGateway } from './queue/queue.gateway';
import { PrismaService } from './lib/prisma.service';
import { SubscriptionsController } from './subscriptions/subscriptions.controller';
import { QueueController } from './queue/queue.controoler';

@Module({
  providers: [QueueGateway, PrismaService],
  controllers: [SubscriptionsController, QueueController],
})
export class AppModule {}
