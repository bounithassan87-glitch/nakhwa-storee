// Day boundaries in the store's own timezone.
//
// The dashboard used UTC, so "today" began at 01:00 Moroccan time and every
// order placed between midnight and 1am was reported against the previous day.
// For a shop whose evening traffic runs past midnight that is not a rounding
// error, it is the wrong day.
//
// The zone is resolved through the IANA database rather than a fixed +1 offset,
// because Morocco is NOT a constant offset: it sits on UTC+1 most of the year
// and moves to UTC+0 for Ramadan, returning afterwards. A hardcoded offset
// would silently mis-bucket a month of data every year.
//
// Database timestamps are untouched. This only decides which instants belong to
// which reporting day.

export const STORE_TIMEZONE = "Africa/Casablanca";

const DAY_MS = 86_400_000;

/**
 * The zone's offset from UTC, in milliseconds, at a given instant.
 *
 * Works by formatting the instant as wall-clock time in the zone and reading it
 * back as though it were UTC; the difference is the offset. This is the standard
 * approach when the runtime has no direct offset API, and it follows the IANA
 * rules — including Morocco's Ramadan shift.
 */
export function zoneOffsetMs(date, timeZone = STORE_TIMEZONE) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = {};
    for (const p of dtf.formatToParts(date)) {
      if (p.type !== "literal") parts[p.type] = p.value;
    }
    const asUTC = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second),
    );
    return asUTC - date.getTime();
  } catch {
    // A runtime without the zone data would otherwise throw on every request.
    // UTC is wrong by an hour; a 500 is wrong by the whole page.
    return 0;
  }
}

/** The instant at which the store-local day containing `date` began. */
export function startOfStoreDay(date, timeZone = STORE_TIMEZONE) {
  const off = zoneOffsetMs(date, timeZone);
  const shifted = new Date(date.getTime() + off);
  const localMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  let start = new Date(localMidnight - off);
  // Re-resolve once: if the offset changed between the instant and midnight —
  // the Ramadan boundary — the first subtraction used the wrong one.
  const off2 = zoneOffsetMs(start, timeZone);
  if (off2 !== off) start = new Date(localMidnight - off2);
  return start;
}

/** The last millisecond of that same store-local day. */
export function endOfStoreDay(date, timeZone = STORE_TIMEZONE) {
  const start = startOfStoreDay(date, timeZone);
  const nextNoon = new Date(start.getTime() + DAY_MS + DAY_MS / 2);
  return new Date(startOfStoreDay(nextNoon, timeZone).getTime() - 1);
}

/** `YYYY-MM-DD` as written in the store's timezone, for grouping by day. */
export function storeDayKey(date, timeZone = STORE_TIMEZONE) {
  try {
    // en-CA yields ISO-ordered parts.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Add whole store-local days, staying correct across an offset change. */
export function addStoreDays(date, days, timeZone = STORE_TIMEZONE) {
  const start = startOfStoreDay(date, timeZone);
  // Land at local noon of the target day, then snap — noon is far from any
  // transition, so the day is never ambiguous.
  const approx = new Date(start.getTime() + days * DAY_MS + DAY_MS / 2);
  return startOfStoreDay(approx, timeZone);
}

/**
 * Resolve a dashboard range key into an inclusive instant window.
 *
 * Same keys and the same shape the analytics endpoint already returned, so no
 * caller has to change — only the boundaries move from UTC to store-local.
 */
export function resolveStoreRange(key, fromStr, toStr, now = new Date(), timeZone = STORE_TIMEZONE) {
  const todayStart = startOfStoreDay(now, timeZone);
  const endToday = endOfStoreDay(now, timeZone);

  switch (key) {
    case "today":
      return { key: "today", from: todayStart, to: endToday };
    case "yesterday": {
      const y = addStoreDays(now, -1, timeZone);
      return { key: "yesterday", from: y, to: endOfStoreDay(y, timeZone) };
    }
    case "last30":
      return { key: "last30", from: addStoreDays(now, -29, timeZone), to: endToday };
    case "thisMonth": {
      const dayOfMonth = Number(storeDayKey(now, timeZone).slice(8, 10));
      return { key: "thisMonth", from: addStoreDays(now, -(dayOfMonth - 1), timeZone), to: endToday };
    }
    case "custom": {
      const parsedFrom = fromStr && !Number.isNaN(Date.parse(fromStr)) ? new Date(`${String(fromStr).slice(0, 10)}T12:00:00Z`) : null;
      const parsedTo = toStr && !Number.isNaN(Date.parse(toStr)) ? new Date(`${String(toStr).slice(0, 10)}T12:00:00Z`) : null;
      return {
        key: "custom",
        from: parsedFrom ? startOfStoreDay(parsedFrom, timeZone) : addStoreDays(now, -6, timeZone),
        to: parsedTo ? endOfStoreDay(parsedTo, timeZone) : endToday,
      };
    }
    case "last7":
    default:
      return { key: "last7", from: addStoreDays(now, -6, timeZone), to: endToday };
  }
}
