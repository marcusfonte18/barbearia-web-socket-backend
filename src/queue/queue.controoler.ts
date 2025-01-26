import { Controller, Get } from '@nestjs/common';
import { PrismaService } from 'src/lib/prisma.service';

@Controller('queue')
export class QueueController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll() {
    const result = await this.prisma.queue.findMany({
      orderBy: { position: 'asc' },
      select: {
        id: true,
        position: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            id: true,
            isAdmin: true,
          },
        },
      },
    });

    return result;
  }
}
