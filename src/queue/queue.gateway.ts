import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/lib/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class QueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    console.log('Cliente conectado:', client.id);
    const queue = await this.getQueue();
    client.emit('QUEUE_UPDATED', queue);
  }

  handleDisconnect(client: Socket) {
    console.log('Cliente desconectado:', client.id);
  }

  async getQueue() {
    return await this.prisma.queue.findMany({
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
  }

  @SubscribeMessage('ADD_TO_QUEUE')
  async addToQueue(@MessageBody() { userId }: { userId: string }) {
    const positionCount = (await this.prisma.queue.count()) + 1;
    await this.prisma.queue.create({
      data: { position: positionCount, userId },
    });

    this.broadcastQueue();
  }

  @SubscribeMessage('REMOVE_TO_QUEUE')
  async removeFromQueue(@MessageBody() { id }: { id: string }) {
    await this.prisma.queue.delete({ where: { id } });

    const remainingQueue = await this.prisma.queue.findMany({
      orderBy: { position: 'asc' },
    });

    for (let i = 0; i < remainingQueue.length; i++) {
      await this.prisma.queue.update({
        where: { id: remainingQueue[i].id },
        data: { position: i + 1 },
      });
    }
    this.broadcastQueue();
  }

  private async broadcastQueue() {
    const queue = await this.getQueue();
    this.server.emit('QUEUE_UPDATED', queue);
  }
}
