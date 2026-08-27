import { toZonedTime } from 'date-fns-tz';

/**
 * Returns a UTC Date object representing midnight in the Africa/Addis_Ababa timezone.
 * This ensures that regardless of where the server is located, the checkInDate
 * stored in the DB strictly aligns with the gym's local day.
 */
export function getGymLocalDayDate(): Date {
  // Get current UTC time, shift it to Addis Ababa time
  const gymTime = toZonedTime(new Date(), 'Africa/Addis_Ababa');
  
  // Truncate to midnight local time, but represent as a UTC Date for Prisma @db.Date mapping
  const localDayDate = new Date(Date.UTC(
    gymTime.getFullYear(),
    gymTime.getMonth(),
    gymTime.getDate()
  ));
  
  return localDayDate;
}
