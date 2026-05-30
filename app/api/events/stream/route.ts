import { NextResponse } from 'next/server';
import { eventBus } from '@/lib/sse/eventBus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  let ctrl: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      ctrl = controller;
      eventBus.addClient(ctrl);
      ctrl.enqueue(new TextEncoder().encode(': connected\n\n'));
    },
    cancel() {
      eventBus.removeClient(ctrl);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
