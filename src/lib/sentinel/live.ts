// Server-side wrapper around Sentinel's /ws/live endpoint.
//
// IMPORTANT: this must only ever run on the server. The WebSocket endpoint authenticates
// via a ?key= query param (Bearer headers aren't practical for the WS upgrade handshake),
// so connecting from the browser would mean shipping the read key to the client — exactly
// what the "never expose the Sentinel key client-side" rule forbids. Live Activity in the
// browser (Batch 2) subscribes to a same-origin SSE route instead; that route holds one
// SentinelLiveClient instance and re-broadcasts its events to connected browsers.
import WebSocket from 'ws';

export type LiveUser = {
  id: number;
  username: string;
  displayName: string | null;
  thumb: string | null;
} | null;

export type LiveMedia = {
  ratingKey: string;
  title: string;
  type: string;
  grandparentTitle: string | null;
  parentTitle: string | null;
  year: number | null;
  thumb: string | null;
} | null;

export type LiveSession = {
  sessionKey: string;
  state: string; // playing | paused
  viewOffset: number | null;
  startedAt: number;
  updatedAt: number;
  platform: string | null;
  player: string | null;
  ipAddress: string | null;
  transcodeDecision: string | null;
  videoDecision: string | null;
  audioDecision: string | null;
  qualityProfile: string | null;
  user: LiveUser;
  media: LiveMedia;
};

export type LiveEvent =
  | { event: 'snapshot'; sessions: LiveSession[] }
  | { event: 'play' | 'pause' | 'resume'; session: LiveSession; sessions: LiveSession[] }
  | { event: 'stop'; sessionKey: string; sessions: LiveSession[] }
  | { event: 'heartbeat'; ts: number };

const RECONNECT_BASE_MS = 5000;
const RECONNECT_MAX_MS = 300000; // 5 minutes

export type SentinelLiveClientOptions = {
  onEvent: (event: LiveEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

/** Maintains a persistent, auto-reconnecting connection to Sentinel's live WebSocket. */
export class SentinelLiveClient {
  private ws: WebSocket | null = null;
  private stopped = false;
  private reconnectAttempts = 0;

  constructor(private options: SentinelLiveClientOptions) {}

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.ws?.close();
    this.ws = null;
  }

  private connect(): void {
    if (this.stopped) return;

    const sentinelUrl = process.env.SENTINEL_URL;
    const apiKey = process.env.SENTINEL_API_KEY;
    if (!sentinelUrl || !apiKey) {
      throw new Error('SENTINEL_URL/SENTINEL_API_KEY must be configured before starting a live connection.');
    }

    const wsUrl = `${sentinelUrl.replace(/^http/, 'ws').replace(/\/+$/, '')}/ws/live?key=${apiKey}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      this.reconnectAttempts = 0;
      this.options.onConnect?.();
    });

    this.ws.on('message', (data) => {
      try {
        this.options.onEvent(JSON.parse(data.toString()) as LiveEvent);
      } catch {
        // Malformed frame — ignore rather than crash the connection.
      }
    });

    this.ws.on('close', () => {
      this.options.onDisconnect?.();
      this.scheduleReconnect();
    });

    this.ws.on('error', () => {
      this.ws?.close();
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempts, RECONNECT_MAX_MS);
    this.reconnectAttempts += 1;
    setTimeout(() => this.connect(), delay);
  }
}
