import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** String form of a number for display (serials, counts). */
export function toDigits(value: number | string): string {
  return String(value);
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Formats an ISO date (YYYY-MM-DD) as "9 October 2026".
 * Pure calendar formatting — no timezone conversion (the date is already
 * the appointment day in the clinic's timezone).
 */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "9 October 2026 (Thursday)" */
export function formatDateWithDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${formatDate(isoDate)} (${weekday})`;
}

/** Compact "09/10/2026" (DD/MM/YYYY) for dense rows. */
export function formatDateCompact(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** "9 October 2026, 3:45 PM" for audit timestamps. */
export function formatDateTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = String(Number(get("day")));
  const month = MONTHS[Number(get("month")) - 1] ?? get("month");
  const year = get("year");
  const hour = get("hour").replace(/^0/, "");
  const minute = get("minute");
  const dayPeriod = get("dayPeriod").toLowerCase() === "pm" ? "PM" : "AM";
  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
}
