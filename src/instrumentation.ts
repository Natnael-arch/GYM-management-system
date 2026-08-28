import { zktecoService } from './lib/zkteco';
import { prisma } from './lib/prisma';
import { processCheckIn } from './lib/checkin-service';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Starting Node.js background services...');
    
    // Connect to ZKTeco
    await zktecoService.connect();

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
        
        // If integrated with hardware, you'd trigger the door relay here if allowed
        if (result.allowed) {
          // Trigger local relay if configured (out of scope for Phase 8)
        }
      } catch (err) {
        console.error('[ZKTeco] Error processing check-in event:', err);
      }
    });
  }
}
