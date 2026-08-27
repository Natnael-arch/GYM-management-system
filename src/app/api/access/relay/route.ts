import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { command } = await request.json();
    
    if (command === 'unlock') {
      // -------------------------------------------------------------
      // DOOR CONTROL NO-OP STUB
      // -------------------------------------------------------------
      // This is where you would call a local USB relay daemon (e.g. via fetch to localhost:port)
      // or an external API like Kisi (fetch to api.kisi.io/relays/unlock).
      // Since hardware target is unconfirmed, this successfully no-ops.
      console.log(`[DOOR CONTROL] Relay trigger executed at ${new Date().toISOString()}`);
      
      return NextResponse.json({ success: true, message: 'Relay triggered (no-op)' });
    }

    return NextResponse.json({ error: 'Unknown command' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
