import { Module } from '@nestjs/common';
import { QueueGateway } from './queue/queue.gateway';
import { PrismaService } from './lib/prisma.service';

@Module({
  providers: [QueueGateway, PrismaService],
})
export class AppModule {}
