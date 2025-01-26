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

import * as webpush from 'web-push';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class QueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {
    console.log(webpush);
    webpush.setVapidDetails(
      'mailto:barba.club.barbearia.2010@gmail.com',
      'BDB1nk4hFfUIGFFPuRwU55sRzB-jMnSSYdMKzoC1rkgFfuSMT7CGPn2LM37qmmM_s5J1R6JpbE3S-56q0y5qdG4',
      'FbAQMxAZVC_bJ1IXuwBT6GihgdL1wNBRunmoJwRWx2w',
    );
  }

  async updateQueuePositions(remainingQueue) {
    const queue = await this.prisma.queue.findMany();

    queue.forEach(async (item) => {
      const userPosition = remainingQueue.find((item) => item.id === item.id);

      if (item.position !== userPosition.position) {
        const subscription = await this.prisma.pushSubscription.findFirst({
          where: { userId: item.userId },
        });
        if (subscription) {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            JSON.stringify({
              title: 'Mudança na fila',
              body: `Sua posição na fila agora é #${item.position}.`,
              icon: '/icon.png', // Opcional: URL do ícone
            }),
          );
        }
      }
    });
  }

  async handleConnection(client: Socket) {
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

    await this.updateQueuePositions(remainingQueue);
    this.broadcastQueue();
  }

  private async broadcastQueue() {
    const queue = await this.getQueue();
    this.server.emit('QUEUE_UPDATED', queue);
  }
}
