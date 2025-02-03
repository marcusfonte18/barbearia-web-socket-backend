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
import * as webpush from 'web-push';

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

  constructor(private prisma: PrismaService) {
    webpush.setVapidDetails(
      'mailto:barba.club.barbearia.2010@gmail.com',
      'BDB1nk4hFfUIGFFPuRwU55sRzB-jMnSSYdMKzoC1rkgFfuSMT7CGPn2LM37qmmM_s5J1R6JpbE3S-56q0y5qdG4',
      'FbAQMxAZVC_bJ1IXuwBT6GihgdL1wNBRunmoJwRWx2w',
    );
  }

  async getBarbershopStatus() {
    const barbershop = await this.prisma.barbershop.findFirst();
    return barbershop?.is_open;
  }

  async handleConnection(client: Socket) {
    const barberId = client.handshake.query.barberId as string;

    const queue = await this.getQueue(barberId);
    const isOpen = await this.getBarbershopStatus();

    client.emit('QUEUE_UPDATED', queue);
    client.emit('BARBER_STATUS', { isOpen });
  }

  handleDisconnect(client: Socket) {
    console.log('Cliente desconectado:', client.id);
  }

  async getQueue(barberId: string) {
    if (!barberId) return;

    return await this.prisma.queue.findMany({
      where: { barberId },
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

  @SubscribeMessage('BARBER_STATUS')
  async handleBarberStatus() {
    const barbershop = await this.prisma.barbershop.findFirst();

    if (!barbershop) {
      await this.prisma.barbershop.create({
        data: { is_open: true, opened_at: new Date() },
      });

      await this.sendUpdateBarberStatus(
        'Barbearia aberta ✂️',
        'Já estamos abertos! Venha garantir seu corte e evitar filas. Agende-se agora!',
      );
      return this.server.emit('BARBER_STATUS', { isOpen: true });
    }

    if (barbershop.is_open) {
      await this.prisma.barbershop.update({
        where: { id: barbershop.id },
        data: { is_open: false },
      });

      await this.sendUpdateBarberStatus(
        'Barbearia fechada 🚪',
        'A barbearia fechou no momento. Fique de olho para quando reabrirmos!',
      );
      return this.server.emit('BARBER_STATUS', { isOpen: false });
    }

    await this.prisma.barbershop.update({
      where: { id: barbershop.id },
      data: { is_open: true, opened_at: new Date() },
    });

    await this.sendUpdateBarberStatus(
      'Barbearia aberta ✂️',
      'Já estamos abertos! Venha garantir seu corte e evitar filas. Agende-se agora!',
    );

    return this.server.emit('BARBER_STATUS', { isOpen: true });
  }

  @SubscribeMessage('ADD_TO_QUEUE')
  async addToQueue(
    @MessageBody() { userId, barberId }: { userId: string; barberId: string },
  ) {
    const positionCount = await this.prisma.queue.count({
      where: { barberId },
    });

    await this.prisma.queue.create({
      data: {
        position: positionCount + 1,
        userId,
        barberId,
      },
    });

    this.broadcastQueue(barberId);
  }

  @SubscribeMessage('REMOVE_TO_QUEUE')
  async removeFromQueue(
    @MessageBody() { id, barberId }: { id: string; barberId: string },
  ) {
    await this.prisma.queue.delete({ where: { id } });

    const remainingQueue = await this.prisma.queue.findMany({
      where: { barberId },
      orderBy: { position: 'asc' },
    });

    for (let i = 0; i < remainingQueue.length; i++) {
      await this.prisma.queue.update({
        where: { id: remainingQueue[i].id },
        data: { position: i + 1 },
      });
    }

    await this.sendUpdateQueuePosition(remainingQueue, barberId);
    this.broadcastQueue(barberId);
  }

  private async broadcastQueue(barberId: string) {
    const queue = await this.getQueue(barberId); // Busca a fila do barbeiro específico
    this.server.emit('QUEUE_UPDATED', queue); // Envia apenas a fila do barbeiro
  }

  private async sendPushNotification(
    subscription: any,
    title: string,
    body: string,
  ) {
    if (!subscription) return;

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify({ title, body, icon: '/icon.png' }),
      );
    } catch (error) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.warn('Removendo subscription inválida:', subscription.endpoint);
        await this.prisma.pushSubscription.delete({
          where: { endpoint: subscription.endpoint },
        });
      } else {
        console.error('Erro ao enviar push notification:', error);
      }
    }
  }

  async sendUpdateBarberStatus(body: string, title: string) {
    const subscriptions = await this.prisma.pushSubscription.findMany();

    await Promise.all(
      subscriptions.map((sub) => this.sendPushNotification(sub, title, body)),
    );
  }

  async sendUpdateQueuePosition(remainingQueue, barberId: string) {
    const queue = await this.prisma.queue.findMany({
      where: { barberId },
    });

    const notifications = queue.map(async (item) => {
      const userPosition = remainingQueue.find((qItem) => qItem.id === item.id);
      if (item.position !== userPosition?.position) {
        const subscription = await this.prisma.pushSubscription.findFirst({
          where: { userId: item.userId },
        });

        if (subscription) {
          return this.sendPushNotification(
            subscription,
            'Mudança na fila',
            `Sua posição na fila agora é #${item?.position}.`,
          );
        }
      }
    });

    await Promise.all(notifications);
  }
}
