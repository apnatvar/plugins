# Business Hours Engine

[![CI](https://github.com/apnatvar/plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/apnatvar/plugins/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40brownsmithdynamics%2Fbusiness-hours)](https://www.npmjs.com/org/brownsmithdynamics)

A TypeScript operating-hours library from [Brownsmith Dynamics](https://brownsmithdynamics.com).
Weekly periods, overnight shifts, civil-date overrides, and IANA time zones. MIT licensed.

**Release state:** prepared locally, unpublished. The npm badge will resolve after publication;
its target is the owner-confirmed organization `brownsmithdynamics`. Organization
membership and publishing permission still require verification. The repository link above is verified; this new
subdirectory and workflow must be committed and pushed before source and CI are public.

## Installation

After manual publication:

```sh
npm install @brownsmithdynamics/business-hours
```

Requires Node.js 22+ with full Intl/IANA time-zone support. ESM and TypeScript declarations
are provided; CommonJS is not supported. For an unpublished checkout use `npm ci`,
`npm run build`, then `npm pack` and install the resulting tarball.

## Quick start: fictional shop

```ts
import { BusinessHours } from '@brownsmithdynamics/business-hours';

const shop = new BusinessHours({
  timeZone: 'Europe/London',
  weekly: {
    1: [{ open: '09:00', close: '17:00' }],
    2: [{ open: '09:00', close: '17:00' }],
    3: [{ open: '09:00', close: '17:00' }],
    4: [{ open: '09:00', close: '17:00' }],
    5: [{ open: '09:00', close: '17:00' }],
  },
  holidays: ['2026-12-25'],
  exceptions: { '2026-12-24': [{ open: '09:00', close: '13:00' }] },
});
shop.isOpen('2026-10-26T10:00:00Z'); // true
shop.nextClosing('2026-10-26T10:00:00Z'); // '2026-10-26T17:00:00Z'
shop.openDuration('2026-10-26T00:00:00Z', '2026-10-27T00:00:00Z'); // 28800000 ms
```

## Schedule configuration

`weekly` is required; `{}` is a valid always-closed schedule. Weekdays use ISO numbers:
Monday 1 through Sunday 7. Missing days and empty arrays are closed. Periods use strict,
zero-padded `HH:mm`, with minute precision; `24:00` is permitted only as a closing time.
`{open:'00:00',close:'24:00'}` expresses a full civil day. Equal endpoints are rejected.
A closing time earlier than opening means the next civil day, at most one overnight shift.
Schedules may be unsorted. Overlap is allowed and reported by `detectConflicts`;
operating-hour calculations use the union, counting overlapping time only once.

Fictional restaurant with lunch, dinner and a Friday overnight service:

```ts
const restaurant = new BusinessHours({
  timeZone: 'America/New_York',
  weekly: {
    2: [{ open: '11:30', close: '14:00' }, { open: '17:00', close: '22:00' }],
    5: [{ open: '18:00', close: '02:00' }],
  },
});
```

## Time boundaries and time zones

All operating and query intervals are **half-open `[start, end)`**. Opening is included;
closing is excluded. An appointment ending exactly at closing is valid. An appointment
starting at closing is outside hours. Empty/reversed query or appointment intervals throw;
zero-duration appointments are not accepted. Adjacent periods merge: 09:00–12:00 and
12:00–17:00 remain continuously open, with no transition at noon.

Pass instants as valid `Date`, integer epoch milliseconds, or ISO date-time strings with
an explicit `Z` or numeric offset. Offset-free local date-times are rejected. Results use
canonical UTC ISO strings; durations are elapsed milliseconds, not nominal wall-clock hours.
Instant strings allow at most three fractional-second digits; submillisecond precision
and leap-second strings are rejected rather than rounded.
No method reads the system clock. Pass a clock value explicitly, e.g. `new Date()` in your app.
Configuration dates use ISO `YYYY-MM-DD` in the business's time zone, years 0001–9998.
The host process's local time zone does not determine business dates.

IANA zones such as `Asia/Kolkata`, `Europe/London`, and `America/New_York`, plus `UTC`,
are supported; invalid zones and numeric-offset zone identifiers are rejected.
The Temporal polyfill uses the runtime's Intl time-zone data. Identical configuration,
inputs, provider responses, and runtime tzdata give deterministic results. Political
changes can alter future results after a runtime update; keep deployed runtime data current.

## DST edge cases

`disambiguation` applies to every local period boundary:

| Value | Repeated local time (fall back) | Nonexistent local time (spring forward) |
| --- | --- | --- |
| `compatible` (default) | Earlier occurrence | Shift forward by the gap |
| `earlier` | Earlier occurrence | Shift backward by the gap |
| `later` | Later occurrence | Shift forward by the gap |
| `reject` | Throw | Throw |

For New York on 2026-03-08, 01:00–04:00 is two elapsed hours. On 2026-11-01,
00:00–03:00 is four elapsed hours. Non-hour transitions and skipped civil dates are
handled through Temporal. Boundaries are resolved separately; if resolution collapses
or reverses a period it contributes no open interval. Civil-day clipping prevents a
resolved interval from leaking into an overridden day. Use `reject` if your business
requires explicit intervention rather than shifted boundaries. This policy does not
express choosing different disambiguations for the start and end of a single period.

## Holidays and exceptional hours

Precedence for a local civil date is: explicit `exceptions` entry, then `holidays` or
provider closure, then weekly schedule. Exceptions replace the whole day's schedule;
an empty array is a one-off closure. An exception can reopen a holiday.

Overrides apply to the **entire civil date**, including incoming overnight hours.
A Friday 22:00–Saturday 02:00 shift ends at Saturday midnight if Saturday is a holiday
or exception. An exceptional overnight period can carry into the next date only when
that date has no override. A normal closed weekday still accepts the previous day's
carry-in. Overrides do not cancel the earlier part of a previous-day shift.

```ts
const clinic = new BusinessHours({
  timeZone: 'Asia/Kolkata',
  weekly: { 1: [{ open: '08:00', close: '12:00' }, { open: '14:00', close: '18:00' }] },
  holidays: ['2026-10-26'], // supplied by the application
  exceptions: { '2026-10-26': [{ open: '10:00', close: '12:00' }], '2026-11-02': [] },
});
```

Optional provider (no holiday database or network client is included):

```ts
const publicHolidays = new Set(['2026-12-25', '2027-01-01']);
const hours = new BusinessHours({
  timeZone: 'UTC', weekly: {},
  holidayProvider: { isHoliday: (localDate: string) => publicHolidays.has(localDate) },
});
```

The provider is synchronous, must return a boolean, and should be pure, fast and local.
Provider failures become explicit library errors. Do not perform I/O in callbacks.
External lists remain your responsibility for completeness, observed-day policy,
updates and redistribution rights. The library never fetches holidays.

## Appointment availability

Fictional consultation practice:

```ts
const consultations = new BusinessHours({
  timeZone: 'UTC',
  weekly: { 1: [{ open: '09:00', close: '12:00' }, { open: '13:00', close: '17:00' }] },
});
consultations.validateAppointment('2026-10-26T11:30:00Z', '2026-10-26T12:00:00Z');
// { valid: true, reason: 'within-hours' }
consultations.validateAppointment('2026-10-26T11:30:00Z', '2026-10-26T13:30:00Z');
// { valid: false, reason: 'outside-hours' } — crosses the lunch closure
```

This validates opening-hours containment only; it does not reserve a slot or check
staff, capacity, existing bookings, payment, lead time or service duration rules.

## API reference

| Export/method | Result |
| --- | --- |
| `new BusinessHours(config)` | Validated engine with an independent schedule snapshot |
| `validateSchedule(config)` | Validates configuration; throws on invalid input |
| `isOpen(instant)` | Boolean membership in effective hours |
| `getOpenIntervals(start, end)` | Sorted, merged UTC `{start, end}[]`, clipped to the query |
| `nextOpening(instant, options?)` | Next actual closed-to-open transition or `null` |
| `nextClosing(instant, options?)` | Next actual open-to-closed transition or `null` |
| `getStatus(instant)` | `{isOpen, nextOpening, nextClosing}` |
| `validateAppointment(start, end)` | `{valid, reason: 'within-hours' \| 'outside-hours'}` |
| `openDuration(start, end)` | Total elapsed open milliseconds within the query |
| `detectConflicts(start, end)` | Sorted UTC ranges where effective periods overlap |
| `BusinessHoursError` | Library error with a machine-readable `code` |

Error codes are `INVALID_INPUT`, `LIMIT_EXCEEDED`, `PROVIDER_ERROR`, and `DST_ERROR`.
Conflict results merge adjacent/overlapping ranges where at least two effective
source periods are open; touching source endpoints alone are not a conflict.

`nextOpening`/`nextClosing` use `{inclusive?: boolean, horizonDays?: number}`.
The default is strictly after the supplied instant; `inclusive:true` includes a transition
exactly at it. Being currently open does not itself make the query instant an opening.
A null result means no transition found within the finite search horizon, not proof
of permanent closure or continuous opening. Lookahead uses civil days, not 24-hour durations.

See the shipped `dist/index.d.ts` for all exported configuration, input and result types.

## Common errors and validation

Invalid dates, unknown configuration keys, wrong types, invalid zones, equal endpoints,
invalid query ranges, excessive sizes and callback failures throw explicit errors.
Treat `BusinessHoursError.code` as machine-readable; avoid parsing error messages.
Plain records only are accepted; unsafe keys (`__proto__`, `constructor`, `prototype`),
accessors and unsupported prototypes are rejected. Do not pass class instances as config.
Dates are checked without normalizing February 30 into March. Do not use locale-formatted
strings or a timezone abbreviation such as EST as a substitute for a geographic zone.

## Performance and limits

`maxDays` defaults to 366, configurable from 1 to 3660. Queries exceeding the allowed
civil-date span throw. Search `horizonDays` defaults to 366 (or the smaller configured
limit) and cannot exceed `maxDays`. A small fixed number of boundary days is inspected
for overnight carry and actual transition detection. Limits prevent unbounded calendar scans.
At most 24 periods per day, 10,000 periods in total, and 10,000 holiday and exception
dates each are accepted. Choose smaller query windows for interactive workloads.
Time is approximately O(days × periods plus sorting); memory scales with generated
intervals. No persistent cache, workers, timers or background jobs are started.

## Limitations and non-goals

No reservations, persistent storage, emails, payments, telemetry or external API calls.
No bundled holiday database, recurring annual holiday expressions, resource capacity,
calendar export, leap-second scheduling or nanosecond appointment precision guarantees.
Runtime tzdata controls historical/future timezone accuracy. This is a small engine
rather than a full booking platform; Temporal and its integer arithmetic dependency
are the only runtime dependencies. Browser bundlers can consume ESM with compatible Intl,
but the supported validation matrix is Node.js 22 and 24.

## Development

```sh
npm ci --ignore-scripts
npm run check
npm audit --audit-level=low
npm run check:consumer
```

The consumer check packs, inspects, installs and exercises the actual tarball in a clean
temporary project. Tests use fixed instants and explicit zones, including New York,
London, Kolkata, Lord Howe and Apia. CI is validation only, with no publish credentials.
See [PUBLISHING.md](PUBLISHING.md), [SECURITY.md](SECURITY.md), and [CONTRIBUTING.md](CONTRIBUTING.md).
