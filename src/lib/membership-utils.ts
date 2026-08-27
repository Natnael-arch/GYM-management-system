/**
 * Shared utility to ensure membership status derivation is 100% consistent
 * across the entire application (check-in API, admin dashboards, etc.)
 */

export function getActiveMembershipQuery(gymCurrentTime: Date) {
  return {
    status: 'ACTIVE' as const,
    endsAt: { gte: gymCurrentTime }
  };
}
