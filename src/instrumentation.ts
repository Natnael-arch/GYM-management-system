import { zktecoService } from './lib/zkteco';
import { prisma } from './lib/prisma';
import { processCheckIn } from './lib/checkin-service';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Starting Node.js background services...');

    // Fire-and-forget: never block Next boot when the device is offline.
    // The service retries every 10s on its own.
    zktecoService.connect().catch((err) => {
      console.error('[Instrumentation] ZKTeco initial connect failed (will retry):', err);
    });

    zktecoService.on('attendance', async (data: { deviceUserId: string; timestamp: Date }) => {
      console.log(`[ZKTeco] Processing attendance for device user: ${data.deviceUserId}`);
      
      try {
        // Find mapped member
        const member = await prisma.member.findUnique({
          where: { deviceUserId: data.deviceUserId }
        });

        if (!member) {
          console.warn(`[ZKTeco] No gym member mapped for device user ${data.deviceUserId}`);
          
          await prisma.deniedAttempt.create({
            data: { 
              barcode: data.deviceUserId, 
              reason: 'UNMAPPED_DEVICE_USER' 
            }
          });

          return;
        }

        // Run through standard check-in logic with BIOMETRIC method
        const result = await processCheckIn(member.barcode, 'BIOMETRIC');
        console.log(`[ZKTeco Check-in] Result for ${member.firstName}:`, result);
        
        if (result.allowed) {
          console.log(`[ZKTeco Access] Check-in granted. Triggering relay unlock...`);
          await zktecoService.unlock(3);
        }
      } catch (err) {
        console.error('[ZKTeco] Error processing check-in event:', err);
      }
    });
  }
}
