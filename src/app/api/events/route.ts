import { NextResponse } from 'next/server';
import { globalEmitter } from '@/lib/event-emitter';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const onScan = (data: any) => {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      globalEmitter.on('scan', onScan);

      // Keep connection alive
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(':\n\n'));
      }, 30000);

      request.signal.addEventListener('abort', () => {
        globalEmitter.off('scan', onScan);
        clearInterval(interval);
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
