import { prisma } from './prisma';

export async function logAuditAction(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: string | Record<string, any>
) {
  try {
    const detailsString = typeof details === 'object' ? JSON.stringify(details) : details;

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details: detailsString,
      },
    });
  } catch (error) {
    console.error('[Audit Log Error]', error);
    // We intentionally don't throw here to avoid failing the primary business action 
    // just because logging failed, but in a strict compliance system you might throw.
  }
}
