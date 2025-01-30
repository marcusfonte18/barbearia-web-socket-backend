import { Controller, Get } from '@nestjs/common';
import { PrismaService } from 'src/lib/prisma.service';

@Controller('queue')
export class QueueController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll() {
    const barbers = await this.prisma.barber.findMany({
      include: {
        queue: {
          include: {
            user: true,
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
    });
    return barbers;
  }
}
