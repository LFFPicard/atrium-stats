import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { sentinelConfigured } from '@/lib/sentinel/client';
import { subscribeLive } from '@/lib/sentinel/liveBroadcast';

// Server-Sent Events bridge for Live Activity. Not covered by the generic
// /api/sentinel/[...path] proxy — Sentinel's live feed is a WebSocket authenticated with
// the read key as a query param, which must never reach the browser (see lib/sentinel/live.ts).
// This route holds the one real connection to Sentinel and re-broadcasts it as SSE, which
// browsers can consume same-origin with zero extra auth exposure.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !session.isAdmin) {
    return new Response('Forbidden', { status: 403 });
  }

  // subscribeLive() lazily constructs a SentinelLiveClient, which throws synchronously if
  // SENTINEL_URL/SENTINEL_API_KEY aren't set. Check up front so that shows up as a clean
  // 503 instead of an uncaught throw inside the ReadableStream constructor.
  if (!sentinelConfigured()) {
    return new Response('Sentinel is not configured', { status: 503 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      unsubscribe = subscribeLive((event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller already closed (client disconnected) — cancel() will clean up.
        }
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  request.signal.addEventListener('abort', () => unsubscribe?.());

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
