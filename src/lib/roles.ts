export function hasRole(session: any, allowedRoles: string[]) {
  if (!session?.user?.role) return false;
  return allowedRoles.includes(session.user.role as string);
}
