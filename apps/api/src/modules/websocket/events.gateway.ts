import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export interface JobProgressEvent {
  jobId: string;
  datasetId: string;
  type: 'generation' | 'injection';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message?: string;
  currentObject?: string;
  recordCounts?: Record<string, number>;
  error?: string;
}

export interface SnapshotEvent {
  snapshotId: string;
  environmentId: string;
  status: 'creating' | 'ready' | 'restoring' | 'failed';
  message?: string;
  progress?: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectedClients: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from query or handshake
      const token =
        client.handshake.query.token as string ||
        client.handshake.auth?.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      client.userId = payload.sub;

      // Track connection
      if (!this.connectedClients.has(payload.sub)) {
        this.connectedClients.set(payload.sub, new Set());
      }
      this.connectedClients.get(payload.sub)!.add(client.id);

      // Join user-specific room
      client.join(`user:${payload.sub}`);

      this.logger.log(`Client ${client.id} connected for user ${payload.sub}`);
    } catch (error) {
      this.logger.warn(`Client ${client.id} authentication failed: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userSockets = this.connectedClients.get(client.userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.connectedClients.delete(client.userId);
        }
      }
    }
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('subscribe:dataset')
  handleSubscribeDataset(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { datasetId: string },
  ) {
    const room = `dataset:${data.datasetId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} subscribed to ${room}`);
    return { success: true, room };
  }

  @SubscribeMessage('unsubscribe:dataset')
  handleUnsubscribeDataset(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { datasetId: string },
  ) {
    const room = `dataset:${data.datasetId}`;
    client.leave(room);
    this.logger.debug(`Client ${client.id} unsubscribed from ${room}`);
    return { success: true };
  }

  @SubscribeMessage('subscribe:environment')
  handleSubscribeEnvironment(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { environmentId: string },
  ) {
    const room = `environment:${data.environmentId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} subscribed to ${room}`);
    return { success: true, room };
  }

  @SubscribeMessage('unsubscribe:environment')
  handleUnsubscribeEnvironment(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { environmentId: string },
  ) {
    const room = `environment:${data.environmentId}`;
    client.leave(room);
    this.logger.debug(`Client ${client.id} unsubscribed from ${room}`);
    return { success: true };
  }

  // Methods to emit events from other services

  /**
   * Emit job progress to subscribed clients
   */
  emitJobProgress(userId: string, event: JobProgressEvent) {
    // Emit to user's room
    this.server.to(`user:${userId}`).emit('job:progress', event);

    // Emit to dataset-specific room
    this.server.to(`dataset:${event.datasetId}`).emit('job:progress', event);

    this.logger.debug(
      `Emitted job progress: ${event.type} ${event.status} ${event.progress}% for dataset ${event.datasetId}`,
    );
  }

  /**
   * Emit job completion
   */
  emitJobCompleted(userId: string, event: JobProgressEvent) {
    this.server.to(`user:${userId}`).emit('job:completed', event);
    this.server.to(`dataset:${event.datasetId}`).emit('job:completed', event);
    this.logger.debug(`Emitted job completed for dataset ${event.datasetId}`);
  }

  /**
   * Emit job failure
   */
  emitJobFailed(userId: string, event: JobProgressEvent) {
    this.server.to(`user:${userId}`).emit('job:failed', event);
    this.server.to(`dataset:${event.datasetId}`).emit('job:failed', event);
    this.logger.debug(`Emitted job failed for dataset ${event.datasetId}`);
  }

  /**
   * Emit snapshot status updates
   */
  emitSnapshotUpdate(userId: string, event: SnapshotEvent) {
    this.server.to(`user:${userId}`).emit('snapshot:update', event);
    this.server.to(`environment:${event.environmentId}`).emit('snapshot:update', event);
    this.logger.debug(
      `Emitted snapshot update: ${event.status} for snapshot ${event.snapshotId}`,
    );
  }

  /**
   * Emit a generic notification to a user
   */
  emitNotification(
    userId: string,
    notification: {
      type: 'info' | 'success' | 'warning' | 'error';
      title: string;
      message: string;
      link?: string;
    },
  ) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  /**
   * Check if a user is currently connected
   */
  isUserConnected(userId: string): boolean {
    return this.connectedClients.has(userId) && this.connectedClients.get(userId)!.size > 0;
  }

  /**
   * Get connected client count for a user
   */
  getConnectedClientCount(userId: string): number {
    return this.connectedClients.get(userId)?.size || 0;
  }
}
