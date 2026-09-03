import { NextResponse } from 'next/server';
import { zktecoService } from '@/lib/zkteco';

export async function GET() {
  const endpoint = zktecoService.getDeviceEndpoint();
  return NextResponse.json({
    connected: zktecoService.getStatus(),
    lastError: zktecoService.getLastError(),
    ...endpoint,
  });
}
