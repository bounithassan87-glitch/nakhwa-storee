// Types for store-time.js — day boundaries in the store's own timezone.

export declare const STORE_TIMEZONE: string;

/** The zone's UTC offset in milliseconds at a given instant. */
export declare function zoneOffsetMs(date: Date, timeZone?: string): number;

/** The instant the store-local day containing `date` began. */
export declare function startOfStoreDay(date: Date, timeZone?: string): Date;

/** The last millisecond of that same store-local day. */
export declare function endOfStoreDay(date: Date, timeZone?: string): Date;

/** `YYYY-MM-DD` as written in the store's timezone. */
export declare function storeDayKey(date: Date, timeZone?: string): string;

/** Add whole store-local days, correct across an offset change. */
export declare function addStoreDays(date: Date, days: number, timeZone?: string): Date;

export interface StoreRange {
  key: string;
  from: Date;
  to: Date;
}

/** Resolve a dashboard range key into an inclusive instant window. */
export declare function resolveStoreRange(
  key: string,
  fromStr?: string | null,
  toStr?: string | null,
  now?: Date,
  timeZone?: string,
): StoreRange;
