import { NextResponse } from 'next/server';
import { zktecoService } from '@/lib/zkteco';

export async function GET() {
  return NextResponse.json({
    connected: zktecoService.getStatus()
  });
}
