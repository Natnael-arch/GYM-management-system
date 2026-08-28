import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { EthDateTime } from "ethiopian-calendar-date-converter";

const TIMEZONE = "Africa/Addis_Ababa";

export function formatDualDate(
  date: Date | string,
  options: { includeTime?: boolean; short?: boolean } = {}
): { gc: string; ec: string; full: string } {
  const d = new Date(date);
  
  // Convert to Ethiopian local time for G.C. formatting
  const zonedDate = toZonedTime(d, TIMEZONE);
  
  const gcDateStr = format(zonedDate, options.short ? "MMM d, yyyy" : "d MMMM yyyy");
  
  // Use library to get Ethiopian Date
  const ethDate = EthDateTime.fromEuropeanDate(zonedDate);
  const ecDateStr = `${ethDate.date} ${ethDate.month === 1 ? 'Meskerem' : ethDate.month === 2 ? 'Tikimt' : ethDate.month === 3 ? 'Hidar' : ethDate.month === 4 ? 'Tahsas' : ethDate.month === 5 ? 'Tir' : ethDate.month === 6 ? 'Yekatit' : ethDate.month === 7 ? 'Megabit' : ethDate.month === 8 ? 'Miyazya' : ethDate.month === 9 ? 'Ginbot' : ethDate.month === 10 ? 'Sene' : ethDate.month === 11 ? 'Hamle' : ethDate.month === 12 ? 'Nehase' : 'Pagume'} ${ethDate.year}`;

  let gcFull = `${gcDateStr} G.C.`;
  let ecFull = `${ecDateStr} E.C.`;

  if (options.includeTime) {
    const gcTimeStr = format(zonedDate, "h:mm a");

    // Ethiopian Time Calculation
    const standardHour = zonedDate.getHours();
    let ethHour = ((standardHour - 6 + 12) % 12) || 12;
    const ethMinute = zonedDate.getMinutes().toString().padStart(2, '0');

    gcFull = `${gcDateStr} ${gcTimeStr} G.C.`;
    ecFull = `${ecDateStr} (${ethHour}:${ethMinute} Ethiopian) E.C.`;
  }

  return {
    gc: gcFull,
    ec: ecFull,
    full: options.includeTime ? `${gcFull.replace(' G.C.', '')} (${ecFull.replace(' E.C.', '')})` : `${gcFull} (${ecFull})`
  };
}
