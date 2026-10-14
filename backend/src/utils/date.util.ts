import { AppError } from './error.util';
import { DayOfWeek } from '../types';

/**
 * Application-wide Default Timezone Policy.
 * LifeLedger operates under Asia/Kolkata (Indian Standard Time, UTC+5:30)
 * for clinic and appointment wall-clock schedule interpretation.
 */
export const APP_TIMEZONE = 'Asia/Kolkata';

export interface IZonedTimeComponents {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateString: string; // "YYYY-MM-DD"
  timeString: string; // "HH:mm"
  wallClockMinutes: number; // hour * 60 + minute
}

/**
 * Normalizes a calendar date string (YYYY-MM-DD) to a UTC midnight Date object.
 * This represents the pure calendar date consistently across database records and indexes.
 */
export function normalizeDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new AppError('Invalid date format. Expected YYYY-MM-DD', 400);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new AppError('Invalid date format. Expected YYYY-MM-DD', 400);
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);

  const date = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  if (
    isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    throw new AppError('Invalid calendar date', 400);
  }

  return date;
}

/**
 * Parses "HH:mm" 24-hour time string into total minutes from midnight (0..1439).
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
}

/**
 * Formats total minutes from midnight into 24-hour "HH:mm" string.
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Resolves the DayOfWeek enum for a normalized UTC calendar date.
 */
export function getDayOfWeek(normalizedDate: Date): DayOfWeek {
  const days: DayOfWeek[] = [
    DayOfWeek.SUNDAY,
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY
  ];
  return days[normalizedDate.getUTCDay()] ?? DayOfWeek.SUNDAY;
}

/**
 * Extracts wall-clock date and time components in a given timezone (defaults to Asia/Kolkata).
 */
export function getZonedTimeComponents(
  date: Date = new Date(),
  timeZone: string = APP_TIMEZONE
): IZonedTimeComponents {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const parts = dtf.formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    else if (part.type === 'month') month = parseInt(part.value, 10);
    else if (part.type === 'day') day = parseInt(part.value, 10);
    else if (part.type === 'hour') hour = parseInt(part.value, 10);
    else if (part.type === 'minute') minute = parseInt(part.value, 10);
    else if (part.type === 'second') second = parseInt(part.value, 10);
  }

  const mm = month.toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  const hh = hour.toString().padStart(2, '0');
  const min = minute.toString().padStart(2, '0');

  const dateString = `${year}-${mm}-${dd}`;
  const timeString = `${hh}:${min}`;
  const wallClockMinutes = hour * 60 + minute;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateString,
    timeString,
    wallClockMinutes
  };
}

/**
 * Returns a normalized UTC midnight Date representing the current calendar date in the target timezone.
 * E.g., at 00:30 AM on 2026-09-28 in Asia/Kolkata (even if UTC is 2026-09-27T19:00:00Z),
 * this returns 2026-09-28T00:00:00.000Z.
 */
export function getTodayNormalizedDate(
  now: Date = new Date(),
  timeZone: string = APP_TIMEZONE
): Date {
  const { year, month, day } = getZonedTimeComponents(now, timeZone);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Checks whether a normalized target date is strictly in the past relative to "today" in the target timezone.
 */
export function isDateInPast(
  normalizedTargetDate: Date,
  now: Date = new Date(),
  timeZone: string = APP_TIMEZONE
): boolean {
  const todayMidnight = getTodayNormalizedDate(now, timeZone);
  return normalizedTargetDate.getTime() < todayMidnight.getTime();
}

/**
 * Checks whether a normalized target date is "today" in the target timezone.
 */
export function isDateToday(
  normalizedTargetDate: Date,
  now: Date = new Date(),
  timeZone: string = APP_TIMEZONE
): boolean {
  const todayMidnight = getTodayNormalizedDate(now, timeZone);
  return normalizedTargetDate.getTime() === todayMidnight.getTime();
}

/**
 * Checks whether a "HH:mm" slot has already passed relative to current wall-clock time in the target timezone.
 */
export function isSlotInPast(
  slotStartTime: string,
  now: Date = new Date(),
  timeZone: string = APP_TIMEZONE
): boolean {
  const slotMinutes = timeToMinutes(slotStartTime);
  const currentMinutes = getZonedTimeComponents(now, timeZone).wallClockMinutes;
  return slotMinutes <= currentMinutes;
}
