import { NextResponse } from 'next/server';
import { zktecoService } from '@/lib/zkteco';

export async function POST(request: Request) {
  try {
    const { command, seconds } = await request.json();
    
    if (command === 'unlock') {
      console.log(`[DOOR CONTROL] Relay trigger executed at ${new Date().toISOString()}`);
      const unlocked = await zktecoService.unlock(seconds || 3);
      return NextResponse.json({ success: true, message: 'Relay triggered', unlocked });
    }

    return NextResponse.json({ error: 'Unknown command' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
