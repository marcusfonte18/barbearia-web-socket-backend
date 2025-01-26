import { Controller, Get } from '@nestjs/common';
import { PrismaService } from 'src/lib/prisma.service';

@Controller('queue')
export class QueueController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findOne() {
    const result = await this.prisma.queue.findMany();

    return result;
  }
}
