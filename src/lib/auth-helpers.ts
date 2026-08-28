import { auth } from './auth';
import { headers } from 'next/headers';
import { hasRole } from './roles';

export { hasRole };

export async function requireRole(allowedRoles: string[]) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!hasRole(session, allowedRoles)) return null;
  return session;
}
