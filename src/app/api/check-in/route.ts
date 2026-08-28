import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { processCheckIn } from '@/lib/checkin-service';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    
    if (!rateLimit(ip, 2, 1000)) {
      return NextResponse.json({ allowed: false, reason: 'TOO_MANY_REQUESTS' }, { status: 429 });
    }

    const body = await request.json();
    let barcode = body.barcode;
    const method = body.method === 'BIOMETRIC' ? 'BIOMETRIC' : 'BARCODE';

    if (typeof barcode !== 'string') {
      return NextResponse.json({ allowed: false, reason: 'INVALID_INPUT' }, { status: 400 });
    }
    barcode = barcode.trim();
    if (!barcode || !/^[A-Za-z0-9]+$/.test(barcode)) {
      return NextResponse.json({ allowed: false, reason: 'INVALID_INPUT' }, { status: 400 });
    }

    const result = await processCheckIn(barcode, method);
    
    return NextResponse.json(result, { status: result.status });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ allowed: false, reason: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
