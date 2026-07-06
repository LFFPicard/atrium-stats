// Singleton bridge between one persistent SentinelLiveClient connection and however many
// browser tabs currently have the Live Activity view open. Safe because this app runs as a
// single long-lived Node process (`next start` in Docker), so module-level state persists
// across requests — this would NOT work on a serverless/multi-instance deployment.
import { SentinelLiveClient, LiveEvent, LiveSession } from './live';

type Subscriber = (event: LiveEvent) => void;

let client: SentinelLiveClient | null = null;
let latestSessions: LiveSession[] | null = null;
const subscribers = new Set<Subscriber>();

function ensureClient(): void {
  if (client) return;

  client = new SentinelLiveClient({
    onEvent: (event) => {
      if (event.event !== 'heartbeat') {
        latestSessions = event.sessions;
      }
      for (const subscriber of subscribers) subscriber(event);
    },
    onConnect: () => console.log('[live-broadcast] Connected to Sentinel /ws/live'),
    onDisconnect: () => console.log('[live-broadcast] Disconnected from Sentinel /ws/live — reconnecting'),
  });
  client.start();
}

/**
 * Subscribes to live session events. Immediately replays the latest known snapshot (if any)
 * so a newly-opened tab doesn't have to wait for the next Sentinel-side change to see
 * current state. Returns an unsubscribe function.
 */
export function subscribeLive(subscriber: Subscriber): () => void {
  ensureClient();
  subscribers.add(subscriber);

  if (latestSessions) {
    subscriber({ event: 'snapshot', sessions: latestSessions });
  }

  return () => {
    subscribers.delete(subscriber);
    // Deliberately not tearing down `client` when subscribers hits 0 — keeping the
    // Sentinel connection warm avoids reconnect churn when an admin briefly navigates away.
  };
}
