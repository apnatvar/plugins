import { Temporal } from "@js-temporal/polyfill";

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Period {
  open: string;
  close: string;
}

export interface BusinessHoursConfig {
  timeZone: string;
  weekly: Partial<Record<Weekday, Period[]>>;
  holidays?: string[];
  exceptions?: Record<string, Period[]>;
  /** Return a deterministic answer for each date; results are cached only during one operation. */
  holidayProvider?: { isHoliday(date: string): boolean };
  disambiguation?: "compatible" | "earlier" | "later" | "reject";
  maxDays?: number;
}

export interface SearchOptions {
  inclusive?: boolean;
  horizonDays?: number;
}

export type AppointmentValidation = {
  valid: boolean;
  reason: "within-hours" | "outside-hours";
};

export interface OpenInterval {
  start: string;
  end: string;
}

export interface BusinessHoursStatus {
  isOpen: boolean;
  nextOpening: string | null;
  nextClosing: string | null;
}

export type BusinessHoursErrorCode = "INVALID_INPUT" | "LIMIT_EXCEEDED" | "PROVIDER_ERROR" | "DST_ERROR";

export class BusinessHoursError extends Error {
  readonly code: BusinessHoursErrorCode;

  constructor(message: string, code: BusinessHoursErrorCode = "INVALID_INPUT") {
    super(message);
    this.name = "BusinessHoursError";
    this.code = code;
  }
}

const WEEKDAYS = new Set<number>([1, 2, 3, 4, 5, 6, 7]);
const CONFIG_KEYS = new Set([
  "timeZone",
  "weekly",
  "holidays",
  "exceptions",
  "holidayProvider",
  "disambiguation",
  "maxDays",
]);
const PERIOD_KEYS = new Set(["open", "close"]);
const SEARCH_KEYS = new Set(["inclusive", "horizonDays"]);
const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i;
const MAX_PERIODS = 10_000;
const MAX_DATES = 10_000;
const MAX_PERIODS_PER_DAY = 24;
const HARD_MAX_DAYS = 3_660;
const MIN_DATE = Temporal.PlainDate.from("0001-01-01");
const MAX_DATE = Temporal.PlainDate.from("9998-12-31");

type InternalPeriod = { openMinute: number; closeMinute: number };
type EpochInterval = { start: number; end: number };

function fail(message: string): never {
  throw new BusinessHoursError(message);
}

function failWithCode(message: string, code: BusinessHoursErrorCode): never {
  throw new BusinessHoursError(message, code);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function ownDataEntries(value: Record<string, unknown>, label: string, maxEntries: number): [string, unknown][] {
  const keys = Reflect.ownKeys(value);
  if (keys.length > maxEntries) failWithCode(`${label} may contain at most ${maxEntries} keys`, "LIMIT_EXCEEDED");
  const entries: [string, unknown][] = [];
  for (const key of keys) {
    if (typeof key !== "string") fail(`${label} must not contain symbol keys`);
    if (UNSAFE_KEYS.has(key)) fail(`${label} contains an unsafe key`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) fail(`${label}.${key} must be a data property`);
    entries.push([key, descriptor.value]);
  }
  return entries;
}

function strictObject(value: unknown, allowed: Set<string>, label: string): [string, unknown][] {
  if (!isPlainObject(value)) fail(`${label} must be a plain object`);
  const entries = ownDataEntries(value, label, allowed.size);
  for (const [key] of entries) {
    if (!allowed.has(key)) fail(`${label} contains unknown key "${key}"`);
  }
  return entries;
}

function plainArrayValues(value: unknown, label: string, maxLength: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail(`${label} must be a plain array`);
  }
  if (value.length > maxLength) failWithCode(`${label} may contain at most ${maxLength} entries`, "LIMIT_EXCEEDED");
  const keys = Reflect.ownKeys(value);
  const values: unknown[] = [];
  for (const key of keys) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) fail(`${label} must not have extra array properties`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) fail(`${label}[${key}] must be a data property`);
  }
  if (keys.length - 1 !== value.length) fail(`${label} must not contain array holes`);
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor)) fail(`${label} must not contain array holes`);
    values.push(descriptor.value);
  }
  return values;
}

function parseDate(value: unknown, label: string): Temporal.PlainDate {
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    fail(`${label} must be an ISO date in YYYY-MM-DD form`);
  }
  let date: Temporal.PlainDate;
  try {
    date = Temporal.PlainDate.from(value, { overflow: "reject" });
  } catch {
    fail(`${label} is not a valid calendar date`);
  }
  if (date.year < 1 || date.year > 9998) fail(`${label} must be between 0001-01-01 and 9998-12-31`);
  return date;
}

function parseClock(value: unknown, label: string, allow24: boolean): number {
  if (allow24 && value === "24:00") return 1_440;
  if (typeof value !== "string" || !TIME_RE.test(value)) fail(`${label} must be HH:mm${allow24 ? " or 24:00" : ""}`);
  const hour = Number(value.slice(0, 2));
  const minute = Number(value.slice(3, 5));
  return hour * 60 + minute;
}

function parsePeriod(value: unknown, label: string): InternalPeriod {
  const entries = strictObject(value, PERIOD_KEYS, label);
  const fields = Object.fromEntries(entries);
  if (!Object.hasOwn(fields, "open") || !Object.hasOwn(fields, "close")) {
    fail(`${label} must contain open and close`);
  }
  const openMinute = parseClock(fields.open, `${label}.open`, false);
  const closeMinute = parseClock(fields.close, `${label}.close`, true);
  if (openMinute === closeMinute) fail(`${label} open and close must differ`);
  return { openMinute, closeMinute };
}

function parsePeriods(value: unknown, label: string, counter: { total: number }): InternalPeriod[] {
  const values = plainArrayValues(value, label, MAX_PERIODS_PER_DAY);
  const periods = values.map((period, index) => parsePeriod(period, `${label}[${index}]`));
  counter.total += periods.length;
  if (counter.total > MAX_PERIODS) failWithCode(`schedule may contain at most ${MAX_PERIODS} periods`, "LIMIT_EXCEEDED");
  return periods;
}

function validateTimeZone(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    fail("timeZone must be a non-empty IANA time zone name");
  }
  if (/^[+-]/.test(value)) fail("numeric-offset time zones are not supported");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    Temporal.ZonedDateTime.from({ year: 2000, month: 1, day: 1, timeZone: value });
  } catch {
    fail(`invalid IANA time zone "${value}"`);
  }
  return value;
}

function validateConfig(config: unknown): {
  timeZone: string;
  weekly: Map<Weekday, InternalPeriod[]>;
  holidays: Set<string>;
  exceptions: Map<string, InternalPeriod[]>;
  holidayProvider: { isHoliday(date: string): boolean } | undefined;
  disambiguation: "compatible" | "earlier" | "later" | "reject";
  maxDays: number;
} {
  const entries = strictObject(config, CONFIG_KEYS, "config");
  const fields = Object.fromEntries(entries);
  if (!Object.hasOwn(fields, "timeZone")) fail("config.timeZone is required");
  if (!Object.hasOwn(fields, "weekly")) fail("config.weekly is required");
  const timeZone = validateTimeZone(fields.timeZone);
  const disambiguation = Object.hasOwn(fields, "disambiguation") ? fields.disambiguation : "compatible";
  if (typeof disambiguation !== "string" || !["compatible", "earlier", "later", "reject"].includes(disambiguation)) {
    fail("disambiguation must be compatible, earlier, later, or reject");
  }
  const maxDays = Object.hasOwn(fields, "maxDays") ? fields.maxDays : 366;
  if (typeof maxDays !== "number" || !Number.isInteger(maxDays) || maxDays < 1 || maxDays > HARD_MAX_DAYS) {
    fail(`maxDays must be an integer from 1 to ${HARD_MAX_DAYS}`);
  }

  const weekly = new Map<Weekday, InternalPeriod[]>();
  const counter = { total: 0 };
  const weeklyEntries = strictObject(fields.weekly, new Set([...WEEKDAYS].map(String)), "weekly");
  for (const [key, value] of weeklyEntries) {
    const weekday = Number(key);
    if (!WEEKDAYS.has(weekday)) fail(`weekly key "${key}" must be an ISO weekday from 1 to 7`);
    weekly.set(weekday as Weekday, parsePeriods(value, `weekly.${key}`, counter));
  }

  const holidays = new Set<string>();
  if (fields.holidays !== undefined) {
    const holidayValues = plainArrayValues(fields.holidays, "holidays", MAX_DATES);
    const dates = holidayValues.map((date, index) => parseDate(date, `holidays[${index}]`).toString());
    for (const date of dates) holidays.add(date);
  }

  const exceptions = new Map<string, InternalPeriod[]>();
  if (fields.exceptions !== undefined) {
    if (!isPlainObject(fields.exceptions)) fail("exceptions must be a plain object");
    const exceptionEntries = ownDataEntries(fields.exceptions, "exceptions", MAX_DATES);
    for (const [dateText, periods] of exceptionEntries) {
      const date = parseDate(dateText, `exceptions key "${dateText}"`).toString();
      exceptions.set(date, parsePeriods(periods, `exceptions.${dateText}`, counter));
    }
  }

  let holidayProvider: { isHoliday(date: string): boolean } | undefined;
  if (fields.holidayProvider !== undefined) {
    const providerEntries = strictObject(fields.holidayProvider, new Set(["isHoliday"]), "holidayProvider");
    const providerFields = Object.fromEntries(providerEntries);
    if (typeof providerFields.isHoliday !== "function") fail("holidayProvider.isHoliday must be a function");
    holidayProvider = { isHoliday: providerFields.isHoliday as (date: string) => boolean };
  }

  return {
    timeZone,
    weekly,
    holidays,
    exceptions,
    holidayProvider,
    disambiguation: disambiguation as "compatible" | "earlier" | "later" | "reject",
    maxDays: maxDays as number,
  };
}

/** Validate a schedule without constructing a reusable engine. */
export function validateSchedule(config: BusinessHoursConfig): void {
  validateConfig(config);
}

/** ISO instant strings accept at most millisecond precision; submillisecond and leap-second forms are rejected. */
function parseInstant(value: unknown, label: string): number {
  try {
    if (value instanceof Date) {
      const ms = Date.prototype.getTime.call(value);
      if (!Number.isFinite(ms)) fail(`${label} is an invalid Date`);
      return ms;
    }
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value)) fail(`${label} epoch milliseconds must be a safe integer`);
      return Temporal.Instant.fromEpochMilliseconds(value).epochMilliseconds;
    }
    if (typeof value === "string" && INSTANT_RE.test(value)) {
      return Temporal.Instant.from(value).epochMilliseconds;
    }
  } catch (error) {
    if (error instanceof BusinessHoursError) throw error;
    fail(`${label} is not a valid instant`);
  }
  fail(`${label} must be an ISO instant with Z or offset, a valid Date, or epoch milliseconds`);
}

function instantString(epochMs: number): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMs).toString();
}

function localDate(epochMs: number, timeZone: string): Temporal.PlainDate {
  const date = Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(timeZone).toPlainDate();
  if (Temporal.PlainDate.compare(date, MIN_DATE) < 0 || Temporal.PlainDate.compare(date, MAX_DATE) > 0) {
    fail("instant local date must be between 0001-01-01 and 9998-12-31");
  }
  return date;
}

function atLocalMinute(
  date: Temporal.PlainDate,
  minute: number,
  timeZone: string,
  disambiguation: "compatible" | "earlier" | "later" | "reject",
): number {
  const actualDate = minute === 1_440 ? date.add({ days: 1 }) : date;
  const normalizedMinute = minute === 1_440 ? 0 : minute;
  try {
    const zdt = Temporal.ZonedDateTime.from(
      {
        timeZone,
        year: actualDate.year,
        month: actualDate.month,
        day: actualDate.day,
        hour: Math.floor(normalizedMinute / 60),
        minute: normalizedMinute % 60,
      },
      { disambiguation },
    );
    return zdt.epochMilliseconds;
  } catch (error) {
    const clock = minute === 1_440 ? "24:00" : `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    throw new BusinessHoursError(`could not resolve ${date.toString()} ${clock} in ${timeZone}: ${String(error)}`, "DST_ERROR");
  }
}

function mergeIntervals(intervals: EpochInterval[]): EpochInterval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: EpochInterval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

export class BusinessHours {
  private readonly config: ReturnType<typeof validateConfig>;

  constructor(config: BusinessHoursConfig) {
    this.config = validateConfig(config);
  }

  isOpen(instant: string | Date | number): boolean {
    const at = parseInstant(instant, "instant");
    const date = localDate(at, this.config.timeZone);
    const intervals = this.rawIntervals(date.subtract({ days: 2 }), date);
    return intervals.some((interval) => interval.start <= at && at < interval.end);
  }

  getOpenIntervals(start: string | Date | number, end: string | Date | number): OpenInterval[] {
    const range = this.parseRange(start, end);
    const startDate = localDate(range.start, this.config.timeZone);
    const endDate = localDate(range.end, this.config.timeZone);
    const intervals = this.rawIntervals(startDate.subtract({ days: 2 }), endDate, range.end)
      .map((interval) => ({ start: Math.max(interval.start, range.start), end: Math.min(interval.end, range.end) }))
      .filter((interval) => interval.end > interval.start);
    return mergeIntervals(intervals).map(({ start: a, end: b }) => ({ start: instantString(a), end: instantString(b) }));
  }

  nextOpening(instant: string | Date | number, options?: SearchOptions): string | null {
    return this.nextTransition(instant, options, "opening");
  }

  nextClosing(instant: string | Date | number, options?: SearchOptions): string | null {
    return this.nextTransition(instant, options, "closing");
  }

  validateAppointment(start: string | Date | number, end: string | Date | number): AppointmentValidation {
    const range = this.parseRange(start, end);
    const intervals = mergeIntervals(this.rawIntervals(
      localDate(range.start, this.config.timeZone).subtract({ days: 2 }),
      localDate(range.end, this.config.timeZone),
      range.end,
    ));
    const valid = intervals.some((interval) => interval.start <= range.start && interval.end >= range.end);
    return { valid, reason: valid ? "within-hours" : "outside-hours" };
  }

  openDuration(start: string | Date | number, end: string | Date | number): number {
    const range = this.parseRange(start, end);
    return mergeIntervals(this.rawIntervals(
      localDate(range.start, this.config.timeZone).subtract({ days: 2 }),
      localDate(range.end, this.config.timeZone),
      range.end,
    )).reduce((total, interval) => total + Math.max(0, Math.min(interval.end, range.end) - Math.max(interval.start, range.start)), 0);
  }

  getStatus(instant: string | Date | number): BusinessHoursStatus {
    const at = parseInstant(instant, "instant");
    return {
      isOpen: this.isOpen(at),
      nextOpening: this.nextOpening(at),
      nextClosing: this.nextClosing(at),
    };
  }

  detectConflicts(start: string | Date | number, end: string | Date | number): OpenInterval[] {
    const range = this.parseRange(start, end);
    const from = localDate(range.start, this.config.timeZone).subtract({ days: 2 });
    const to = localDate(range.end, this.config.timeZone);
    const intervals = this.rawIntervals(from, to, range.end);
    // Return union windows where at least two effective source periods overlap.
    const events: { at: number; delta: number }[] = [];
    for (const interval of intervals) {
      const a = Math.max(range.start, interval.start);
      const b = Math.min(range.end, interval.end);
      if (a < b) {
        events.push({ at: a, delta: 1 }, { at: b, delta: -1 });
      }
    }
    events.sort((a, b) => a.at - b.at);
    const conflicts: EpochInterval[] = [];
    let count = 0;
    let previous: number | undefined;
    for (let index = 0; index < events.length;) {
      const event = events[index]!;
      const at = event.at;
      if (previous !== undefined && count >= 2 && at > previous) {
        const last = conflicts[conflicts.length - 1];
        if (last && last.end === previous) last.end = at;
        else conflicts.push({ start: previous, end: at });
      }
      let delta = 0;
      while (index < events.length && events[index]!.at === at) {
        delta += events[index]!.delta;
        index++;
      }
      count += delta;
      previous = at;
    }
    return conflicts
      .map(({ start: a, end: b }) => ({ start: instantString(a), end: instantString(b) }));
  }

  private nextTransition(
    instant: string | Date | number,
    options: SearchOptions | undefined,
    kind: "opening" | "closing",
  ): string | null {
    const at = parseInstant(instant, "instant");
    let inclusive = false;
    let horizon = Math.min(366, this.config.maxDays);
    if (options !== undefined) {
      const entries = strictObject(options, SEARCH_KEYS, "options");
      const fields = Object.fromEntries(entries);
      if (fields.inclusive !== undefined) {
        if (typeof fields.inclusive !== "boolean") fail("options.inclusive must be a boolean");
        inclusive = fields.inclusive;
      }
      if (fields.horizonDays !== undefined) horizon = fields.horizonDays as number;
    }
    if (!Number.isInteger(horizon) || horizon < 1 || horizon > this.config.maxDays) {
      fail(`options.horizonDays must be an integer from 1 to maxDays (${this.config.maxDays})`);
    }
    const date = localDate(at, this.config.timeZone);
    const intervals = mergeIntervals(this.rawIntervals(date.subtract({ days: 2 }), date.add({ days: horizon })));
    const bound = Temporal.Instant.fromEpochMilliseconds(at)
      .toZonedDateTimeISO(this.config.timeZone)
      .add({ days: horizon }).epochMilliseconds;
    for (const interval of intervals) {
      const candidate = kind === "opening" ? interval.start : interval.end;
      if ((inclusive ? candidate >= at : candidate > at) && candidate <= bound) {
        const candidateDate = Temporal.Instant.fromEpochMilliseconds(candidate)
          .toZonedDateTimeISO(this.config.timeZone).toPlainDate();
        if (Temporal.PlainDate.compare(candidateDate, MAX_DATE) <= 0) return instantString(candidate);
      }
    }
    return null;
  }

  private parseRange(startValue: string | Date | number, endValue: string | Date | number): EpochInterval {
    const start = parseInstant(startValue, "start");
    const end = parseInstant(endValue, "end");
    if (end <= start) fail("end must be later than start");
    const startDate = localDate(start, this.config.timeZone);
    const endDate = localDate(end, this.config.timeZone);
    const days = startDate.until(endDate, { largestUnit: "day" }).days;
    if (days > this.config.maxDays) fail(`interval may span at most maxDays (${this.config.maxDays}) local dates`);
    return { start, end };
  }

  private isOverride(date: Temporal.PlainDate, providerResults: Map<string, boolean>): boolean {
    const key = date.toString();
    if (Temporal.PlainDate.compare(date, MIN_DATE) < 0 || Temporal.PlainDate.compare(date, MAX_DATE) > 0) return false;
    if (this.config.exceptions.has(key)) return true;
    if (this.config.holidays.has(key)) return true;
    if (!this.config.holidayProvider) return false;
    const cached = providerResults.get(key);
    if (cached !== undefined) return cached;
    let result: unknown;
    try {
      result = this.config.holidayProvider.isHoliday(key);
    } catch (error) {
      throw new BusinessHoursError(`holidayProvider.isHoliday failed for ${key}: ${String(error)}`, "PROVIDER_ERROR");
    }
    if (typeof result !== "boolean") failWithCode(`holidayProvider.isHoliday must return a boolean for ${key}`, "PROVIDER_ERROR");
    providerResults.set(key, result);
    return result;
  }

  private periodsFor(date: Temporal.PlainDate, providerResults: Map<string, boolean>): InternalPeriod[] {
    const key = date.toString();
    if (this.config.exceptions.has(key)) return this.config.exceptions.get(key)!;
    if (this.isOverride(date, providerResults)) return [];
    const weekday = date.dayOfWeek as Weekday;
    return this.config.weekly.get(weekday) ?? [];
  }

  private rawIntervals(from: Temporal.PlainDate, through: Temporal.PlainDate, clipEnd?: number): EpochInterval[] {
    const intervals: EpochInterval[] = [];
    let date = Temporal.PlainDate.compare(from, MIN_DATE) < 0 ? MIN_DATE : from;
    const lastDate = Temporal.PlainDate.compare(through, MAX_DATE) > 0 ? MAX_DATE : through;
    const providerResults = new Map<string, boolean>();
    while (Temporal.PlainDate.compare(date, lastDate) <= 0) {
      const dayStart = date.toZonedDateTime(this.config.timeZone).epochMilliseconds;
      const nextDate = date.add({ days: 1 });
      const dayEnd = nextDate.toZonedDateTime(this.config.timeZone).epochMilliseconds;
      // A skipped civil date has no elapsed instant range and contributes no hours.
      if (dayEnd > dayStart && (clipEnd === undefined || dayStart < clipEnd)) {
        const clipSpill = this.isOverride(nextDate, providerResults);
        for (const period of this.periodsFor(date, providerResults)) {
          let start = atLocalMinute(date, period.openMinute, this.config.timeZone, this.config.disambiguation);
          const closeDate = period.closeMinute < period.openMinute
            ? nextDate
            : date;
          let end = atLocalMinute(closeDate, period.closeMinute, this.config.timeZone, this.config.disambiguation);
          start = Math.max(start, dayStart);
          if (clipSpill) end = Math.min(end, dayEnd);
          // A skipped date may resolve an overnight close two civil dates ahead.
          // Apply overrides to that actual destination day as well.
          const destination = Temporal.Instant.fromEpochMilliseconds(end - 1)
            .toZonedDateTimeISO(this.config.timeZone).toPlainDate();
          if (Temporal.PlainDate.compare(destination, nextDate) > 0 && this.isOverride(destination, providerResults)) {
            end = Math.min(end, destination.toZonedDateTime(this.config.timeZone).epochMilliseconds);
          }
          if (end > start) intervals.push({ start, end });
        }
      }
      date = nextDate;
    }
    return intervals.sort((a, b) => a.start - b.start || a.end - b.end);
  }
}
