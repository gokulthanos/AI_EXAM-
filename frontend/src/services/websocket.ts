import type { WebSocketMessage } from '../types';

type MessageHandler = (message: WebSocketMessage) => void;
type ConnectionHandler = (connected: boolean) => void;

function resolveUrl(): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined;
  if (configured) return `${configured.replace(/\/$/, '')}/ws`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

/**
 * Thin WebSocket client for the backend real-time channel.
 *
 * The backend broadcasts detection alerts to the `detections` topic, so the
 * client always subscribes to it. Messages are dispatched by their `type`.
 */
class WebSocketService {
  private ws: WebSocket | null = null;
  private connecting: Promise<void> | null = null;
  private listeners = new Map<string, Set<MessageHandler>>();
  private connectionHandlers = new Set<ConnectionHandler>();
  private topics = new Set<string>(['detections']);
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;
  private readonly url = resolveUrl();
  private readonly clientId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connecting) return this.connecting;

    this.manualClose = false;
    this.connecting = new Promise<void>((resolve, reject) => {
      let socket: WebSocket;
      try {
        socket = new WebSocket(`${this.url}?client_id=${this.clientId}`);
      } catch (error) {
        this.connecting = null;
        reject(error);
        return;
      }
      this.ws = socket;

      socket.onopen = () => {
        this.connecting = null;
        this.reconnectAttempts = 0;
        this.emitConnection(true);
        this.topics.forEach((topic) => this.send({ type: 'subscribe', topic }));
        this.send({ type: 'get_active_detections' });
        resolve();
      };

      socket.onmessage = (event) => {
        try {
          this.dispatch(JSON.parse(event.data) as WebSocketMessage);
        } catch {
          // Ignore malformed frames
        }
      };

      socket.onerror = () => {
        if (this.connecting) {
          this.connecting = null;
          reject(new Error('WebSocket connection failed'));
        }
      };

      socket.onclose = () => {
        this.connecting = null;
        this.emitConnection(false);
        if (!this.manualClose) this.scheduleReconnect();
      };
    });

    return this.connecting;
  }

  disconnect(): void {
    this.manualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.emitConnection(false);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= 10) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 15000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        /* onclose schedules the next attempt */
      });
    }, delay);
  }

  private dispatch(message: WebSocketMessage): void {
    const typed = this.listeners.get(message.type);
    typed?.forEach((handler) => handler(message));
    this.listeners.get('*')?.forEach((handler) => handler(message));
  }

  private emitConnection(connected: boolean): void {
    this.connectionHandlers.forEach((handler) => handler(connected));
  }

  onMessage(type: string, handler: MessageHandler): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
    return () => {
      this.listeners.get(type)?.delete(handler);
    };
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  subscribeTopic(topic: string): void {
    this.topics.add(topic);
    this.send({ type: 'subscribe', topic });
  }

  send(message: WebSocketMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  requestActiveDetections(): void {
    this.send({ type: 'get_active_detections' });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const ws = new WebSocketService();
