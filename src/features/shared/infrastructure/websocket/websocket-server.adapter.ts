import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'node:http';
import { Server } from 'node:http';
import type {
  EventPublisherPort,
  PurchaseCompletedPayload,
} from '../../ports/event-publisher.port';
import { logger } from '../config/logger';

/** WebSocket path for subscribing to real-time events (pub/sub). */
const WS_PATH = '/ws/events';

/**
 * Parses userId from request URL query string (?userId=...).
 * Returns null if missing or invalid.
 */
function getUserIdFromRequest(req: IncomingMessage): string | null {
  const url = req.url ?? '';
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return null;
  const params = new URLSearchParams(url.slice(queryStart));
  const userId = params.get('userId');
  if (!userId || userId.trim() === '') return null;
  return userId.trim();
}

/**
 * WebSocket server adapter: implements EventPublisherPort and attaches to an HTTP server.
 * Connections are scoped by userId (query param ?userId=...). Rejects connection if userId missing.
 */
export class WebSocketServerAdapter implements EventPublisherPort {
  private readonly wss: WebSocketServer;
  private readonly connectionsByUser = new Map<string, Set<WebSocket>>();
  private upgradeHandlerBound = false;

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        logger.warn({ url: req.url }, 'WebSocket connection rejected: missing or invalid userId');
        ws.close(4000, 'Missing or invalid userId');
        return;
      }

      this.addConnection(userId, ws);

      ws.on('close', () => this.removeConnection(userId, ws));
      ws.on('error', () => this.removeConnection(userId, ws));
    });
  }

  private addConnection(userId: string, ws: WebSocket): void {
    let set = this.connectionsByUser.get(userId);
    if (!set) {
      set = new Set();
      this.connectionsByUser.set(userId, set);
    }
    set.add(ws);
  }

  private removeConnection(userId: string, ws: WebSocket): void {
    const set = this.connectionsByUser.get(userId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) this.connectionsByUser.delete(userId);
    }
  }

  publishPurchaseCompleted(payload: PurchaseCompletedPayload): void {
    const set = this.connectionsByUser.get(payload.userId);
    if (!set || set.size === 0) return;

    const message = JSON.stringify(payload);
    for (const ws of set) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (err) {
          logger.warn(
            { err: (err as Error).message, userId: payload.userId },
            'Failed to send purchase_completed to client'
          );
        }
      }
    }
  }

  /**
   * Attach to an HTTP server: handle upgrade on path /ws/events and associate connections with userId.
   */
  attachToServer(server: Server): void {
    if (this.upgradeHandlerBound) return;
    this.upgradeHandlerBound = true;

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      const url = request.url ?? '';
      const path = url.split('?')[0];
      if (path !== WS_PATH) {
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        this.wss.emit('connection', ws, request);
      });
    });
  }

  /**
   * Close all client connections and the WebSocket server (graceful shutdown).
   * Uses close code 1001 (Going away) so clients know the server is shutting down.
   * Resolves when the WS server has fully closed. Call before closing the HTTP server.
   */
  close(): Promise<void> {
    const GOING_AWAY = 1001;
    const reason = 'Server shutting down';

    for (const set of this.connectionsByUser.values()) {
      for (const ws of set) {
        if (ws.readyState === WebSocket.OPEN) ws.close(GOING_AWAY, reason);
      }
    }
    this.connectionsByUser.clear();

    return new Promise((resolve) => {
      this.wss.close(() => {
        logger.debug('WebSocket server closed');
        resolve();
      });
    });
  }
}
