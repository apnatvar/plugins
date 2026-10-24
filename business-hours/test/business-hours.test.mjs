import test from 'node:test';
import assert from 'node:assert/strict';
import { BusinessHours, BusinessHoursError, validateSchedule } from '../dist/index.js';

const utc = (weekly) => ({ timeZone: 'UTC', weekly });
const mondaySchedule = (periods = [{ open: '09:00', close: '17:00' }]) =>
  utc({ 1: periods });
const point = (iso) => iso;

test('transition results stay inside the supported calendar domain', () => {
  const hours = new BusinessHours({ timeZone: 'UTC', weekly: {}, exceptions: {
    '9998-12-31': [{ open: '00:00', close: '24:00' }],
  } });
  assert.equal(hours.isOpen('9998-12-31T12:00:00Z'), true);
  assert.equal(hours.nextClosing('9998-12-31T12:00:00Z'), null);
  assert.throws(() => hours.isOpen('0000-01-01T00:00:00Z'), BusinessHoursError);
  assert.throws(() => hours.isOpen('9999-01-01T00:00:00Z'), BusinessHoursError);
});

test('an overnight shift resolved across a skipped date respects the destination closure', () => {
  const ordinary = new BusinessHours({ timeZone: 'Pacific/Apia',
    weekly: { 4: [{ open: '22:00', close: '02:00' }] },
  });
  assert.equal(ordinary.isOpen('2011-12-30T11:00:00Z'), true);
  assert.deepEqual(ordinary.getOpenIntervals('2011-12-30T10:00:00Z', '2011-12-30T13:00:00Z'), [
    { start: '2011-12-30T10:00:00Z', end: '2011-12-30T12:00:00Z' },
  ]);
  const hours = new BusinessHours({ timeZone: 'Pacific/Apia',
    weekly: { 4: [{ open: '22:00', close: '02:00' }] }, holidays: ['2011-12-31'],
  });
  assert.deepEqual(hours.getOpenIntervals('2011-12-30T07:00:00Z', '2011-12-30T13:00:00Z'), [
    { start: '2011-12-30T08:00:00Z', end: '2011-12-30T10:00:00Z' },
  ]);
  assert.equal(hours.isOpen('2011-12-30T11:00:00Z'), false);
});

test('exports the public API and validates schedules', () => {
  assert.equal(typeof BusinessHours, 'function');
  assert.equal(typeof BusinessHoursError, 'function');
  assert.equal(typeof validateSchedule, 'function');
  assert.doesNotThrow(() => validateSchedule(mondaySchedule()));
  assert.throws(() => validateSchedule({ timeZone: 'Not/A_Zone', weekly: {} }), BusinessHoursError);
  assert.throws(() => validateSchedule({ timeZone: 'UTC', weekly: { 0: [{ open: '09:00', close: '17:00' }] } }), BusinessHoursError);
});

test('isOpen accepts explicit instants, Date values, and integer epoch milliseconds', () => {
  const hours = new BusinessHours(mondaySchedule());
  assert.equal(hours.isOpen(point('2024-01-08T09:00:00Z')), true);
  assert.equal(hours.isOpen(point('2024-01-08T16:59:59.999Z')), true);
  assert.equal(hours.isOpen(point('2024-01-08T12:00:00.123Z')), true);
  assert.equal(hours.isOpen(point('2024-01-08T17:00:00Z')), false);
  assert.equal(hours.isOpen(new Date('2024-01-08T12:00:00Z')), true);
  assert.equal(hours.isOpen(Date.parse('2024-01-08T12:00:00Z')), true);
  for (const invalid of ['2024-01-08T12:00:00', '2024-01-08', 'not-a-date', '2024-01-08T12:00:00.1234Z', '2024-01-08T12:00:60Z', NaN, 1.5, new Date(NaN)]) {
    assert.throws(() => hours.isOpen(invalid), BusinessHoursError);
  }
  assert.throws(() => hours.getOpenIntervals(new Date(NaN), '2024-01-08T13:00:00Z'), BusinessHoursError);
});

test('weekly windows use ISO weekdays and half-open boundaries', () => {
  const hours = new BusinessHours(utc({
    1: [{ open: '09:00', close: '12:00' }, { open: '13:00', close: '17:00' }],
    7: [{ open: '22:00', close: '24:00' }],
  }));
  assert.equal(hours.isOpen('2024-01-08T08:59:59.999Z'), false);
  assert.equal(hours.isOpen('2024-01-08T09:00:00Z'), true);
  assert.equal(hours.isOpen('2024-01-08T12:00:00Z'), false);
  assert.equal(hours.isOpen('2024-01-08T13:00:00Z'), true);
  assert.equal(hours.isOpen('2024-01-08T17:00:00Z'), false);
  assert.equal(hours.isOpen('2024-01-07T23:59:59.999Z'), true);
  assert.equal(hours.isOpen('2024-01-08T00:00:00Z'), false);
});

test('a lower-than-open closing time is a valid overnight period', () => {
  const hours = new BusinessHours(utc({ 7: [{ open: '22:00', close: '02:00' }] }));
  assert.equal(hours.isOpen('2024-01-07T23:00:00Z'), true);
  assert.equal(hours.isOpen('2024-01-08T01:00:00Z'), true);
  assert.equal(hours.isOpen('2024-01-08T02:00:00Z'), false);
  assert.deepEqual(hours.getOpenIntervals('2024-01-07T21:00:00Z', '2024-01-08T03:00:00Z'), [
    { start: '2024-01-07T22:00:00Z', end: '2024-01-08T02:00:00Z' },
  ]);
  assert.equal(hours.validateAppointment('2024-01-07T23:00:00Z', '2024-01-08T01:00:00Z').valid, true);
});

test('close at 24:00, touching periods, and overnight periods form a merged union', () => {
  const hours = new BusinessHours(utc({
    1: [{ open: '09:00', close: '12:00' }, { open: '12:00', close: '24:00' }],
    2: [{ open: '00:00', close: '02:00' }],
  }));
  assert.deepEqual(hours.getOpenIntervals('2024-01-08T08:00:00Z', '2024-01-09T03:00:00Z'), [
    { start: '2024-01-08T09:00:00Z', end: '2024-01-09T02:00:00Z' },
  ]);
  assert.deepEqual(hours.getOpenIntervals('2024-01-08T10:00:00Z', '2024-01-08T11:00:00Z'), [
    { start: '2024-01-08T10:00:00Z', end: '2024-01-08T11:00:00Z' },
  ]);
  assert.throws(() => hours.getOpenIntervals('2024-01-08T12:00:00Z', '2024-01-08T12:00:00Z'), BusinessHoursError);
});

test('getOpenIntervals clips ranges, merges adjacent days, and returns canonical UTC strings', () => {
  const hours = new BusinessHours(utc({
    1: [{ open: '22:00', close: '24:00' }],
    2: [{ open: '00:00', close: '02:00' }],
  }));
  assert.deepEqual(hours.getOpenIntervals('2024-01-08T23:00:00+00:00', '2024-01-09T01:00:00Z'), [
    { start: '2024-01-08T23:00:00Z', end: '2024-01-09T01:00:00Z' },
  ]);
});

test('next transitions honor inclusivity, merged windows, and finite horizons', () => {
  const hours = new BusinessHours(utc({
    1: [{ open: '09:00', close: '12:00' }, { open: '12:00', close: '17:00' }],
    2: [{ open: '09:00', close: '17:00' }],
  }));
  assert.equal(hours.nextOpening('2024-01-08T09:00:00Z', { inclusive: true }), '2024-01-08T09:00:00Z');
  assert.equal(hours.nextOpening('2024-01-08T09:00:00Z'), '2024-01-09T09:00:00Z');
  assert.equal(hours.nextClosing('2024-01-08T10:00:00Z'), '2024-01-08T17:00:00Z');
  assert.equal(hours.nextClosing('2024-01-08T17:00:00Z', { inclusive: true }), '2024-01-08T17:00:00Z');
  assert.throws(() => hours.nextOpening('2024-01-08T17:00:00Z', { horizonDays: 0 }), BusinessHoursError);
  assert.equal(hours.nextOpening('2024-01-08T17:00:00Z', { horizonDays: 1 }), '2024-01-09T09:00:00Z');
  assert.throws(() => hours.nextOpening('2024-01-08T17:00:00Z', { horizonDays: 999 }), BusinessHoursError);
  assert.throws(() => hours.nextOpening('2024-01-08T17:00:00Z', { unexpected: true }), BusinessHoursError);
  const accessorOptions = {};
  Object.defineProperty(accessorOptions, 'inclusive', { enumerable: true, get() { throw new Error('getter executed'); } });
  assert.throws(() => hours.nextOpening('2024-01-08T17:00:00Z', accessorOptions), BusinessHoursError);
});

test('maxDays bounds ranges and also caps the default transition search horizon', () => {
  const hours = new BusinessHours({ timeZone: 'UTC', weekly: { 1: [{ open: '09:00', close: '10:00' }] }, maxDays: 1 });
  assert.equal(hours.nextOpening('2024-01-08T11:00:00Z'), null);
  assert.equal(hours.nextClosing('2024-01-08T09:30:00Z'), '2024-01-08T10:00:00Z');
  assert.deepEqual(hours.getStatus('2024-01-08T11:00:00Z'), { isOpen: false, nextOpening: null, nextClosing: null });
  assert.throws(() => hours.nextOpening('2024-01-08T11:00:00Z', { horizonDays: 2 }), BusinessHoursError);
  assert.throws(() => hours.openDuration('2024-01-08T00:00:00Z', '2024-01-10T00:00:00Z'), BusinessHoursError);
});

test('status and appointment validation report open state and outside-hours failures', () => {
  const hours = new BusinessHours(mondaySchedule());
  assert.deepEqual(hours.getStatus('2024-01-08T10:00:00Z'), {
    isOpen: true,
    nextOpening: '2024-01-15T09:00:00Z',
    nextClosing: '2024-01-08T17:00:00Z',
  });
  assert.deepEqual(hours.getStatus('2024-01-08T18:00:00Z'), {
    isOpen: false,
    nextOpening: '2024-01-15T09:00:00Z',
    nextClosing: '2024-01-15T17:00:00Z',
  });
  assert.deepEqual(hours.validateAppointment('2024-01-08T10:00:00Z', '2024-01-08T10:30:00Z'), { valid: true, reason: 'within-hours' });
  assert.deepEqual(hours.validateAppointment('2024-01-08T16:30:00Z', '2024-01-08T17:30:00Z'), { valid: false, reason: 'outside-hours' });
  assert.throws(() => hours.validateAppointment('2024-01-08T17:00:00Z', '2024-01-08T17:00:00Z'), BusinessHoursError);
  assert.throws(() => hours.validateAppointment('2024-01-08T11:00:00Z', '2024-01-08T10:00:00Z'), BusinessHoursError);
});

test('openDuration totals milliseconds across multiple intervals', () => {
  const hours = new BusinessHours(utc({
    1: [{ open: '09:00', close: '12:00' }, { open: '13:00', close: '17:00' }],
  }));
  assert.equal(hours.openDuration('2024-01-08T10:00:00Z', '2024-01-08T16:00:00Z'), 5 * 60 * 60 * 1000);
  assert.equal(hours.openDuration('2024-01-08T17:00:00Z', '2024-01-08T18:00:00Z'), 0);
});

test('detectConflicts returns effective overlapping schedule intersections clipped to the requested window', () => {
  const hours = new BusinessHours(utc({ 1: [
    { open: '09:00', close: '12:00' },
    { open: '11:00', close: '14:00' },
    { open: '13:00', close: '15:00' },
  ] }));
  assert.deepEqual(hours.detectConflicts('2024-01-08T10:00:00Z', '2024-01-08T14:30:00Z'), [
    { start: '2024-01-08T11:00:00Z', end: '2024-01-08T12:00:00Z' },
    { start: '2024-01-08T13:00:00Z', end: '2024-01-08T14:00:00Z' },
  ]);
  const holiday = new BusinessHours({
    timeZone: 'UTC', weekly: { 1: [{ open: '09:00', close: '12:00' }, { open: '11:00', close: '14:00' }] },
    holidays: ['2024-01-08'],
  });
  assert.deepEqual(holiday.detectConflicts('2024-01-08T10:00:00Z', '2024-01-08T13:00:00Z'), []);
});

test('exceptions override holiday lists, providers, and weekly hours for the civil date', () => {
  const hours = new BusinessHours({
    timeZone: 'UTC',
    weekly: { 1: [{ open: '09:00', close: '17:00' }] },
    holidays: ['2024-01-08'],
    exceptions: { '2024-01-08': [{ open: '11:00', close: '12:00' }] },
    holidayProvider: { isHoliday: () => true },
  });
  assert.equal(hours.isOpen('2024-01-08T10:00:00Z'), false);
  assert.equal(hours.isOpen('2024-01-08T11:30:00Z'), true);
});

test('empty and overnight exceptions control carry-in and can reopen holidays', () => {
  const suppressCarry = new BusinessHours({
    timeZone: 'UTC', weekly: { 1: [{ open: '22:00', close: '02:00' }] },
    exceptions: { '2024-01-09': [] },
  });
  assert.equal(suppressCarry.isOpen('2024-01-09T01:00:00Z'), false);

  const reopenHoliday = new BusinessHours({
    timeZone: 'UTC', weekly: { 1: [{ open: '09:00', close: '17:00' }] },
    holidays: ['2024-01-08'], exceptions: { '2024-01-08': [{ open: '11:00', close: '12:00' }] },
  });
  assert.equal(reopenHoliday.isOpen('2024-01-08T11:30:00Z'), true);
  assert.equal(reopenHoliday.isOpen('2024-01-08T10:00:00Z'), false);

  const exceptionOvernight = new BusinessHours({
    timeZone: 'UTC', weekly: {},
    exceptions: { '2024-01-08': [{ open: '22:00', close: '02:00' }], '2024-01-09': [{ open: '09:00', close: '10:00' }] },
  });
  assert.equal(exceptionOvernight.isOpen('2024-01-09T01:00:00Z'), false);
  assert.equal(exceptionOvernight.isOpen('2024-01-09T09:30:00Z'), true);
  assert.equal(exceptionOvernight.isOpen('2024-01-09T02:00:00Z'), false);
});

test('a holiday suppresses overnight carry-in and provider results must be booleans', () => {
  const hours = new BusinessHours({
    timeZone: 'UTC',
    weekly: { 1: [{ open: '22:00', close: '02:00' }] },
    holidays: ['2024-01-09'],
  });
  assert.equal(hours.isOpen('2024-01-09T01:00:00Z'), false);
  assert.throws(() => new BusinessHours({
    timeZone: 'UTC', weekly: { 1: [{ open: '09:00', close: '10:00' }] },
    holidayProvider: { isHoliday: () => 'yes' },
  }).isOpen('2024-01-08T09:30:00Z'), BusinessHoursError);
  assert.throws(() => new BusinessHours({
    timeZone: 'UTC', weekly: { 1: [{ open: '09:00', close: '10:00' }] },
    holidayProvider: { isHoliday() { throw new Error('provider failure'); } },
  }).isOpen('2024-01-08T09:30:00Z'), BusinessHoursError);
});

test('the engine snapshots schedule data before provider callbacks can mutate caller objects', () => {
  const config = {
    timeZone: 'UTC',
    weekly: { 1: [{ open: '09:00', close: '10:00' }] },
    holidayProvider: { isHoliday() { config.weekly[1][0].open = '12:00'; return false; } },
  };
  const hours = new BusinessHours(config);
  assert.equal(hours.isOpen('2024-01-08T09:30:00Z'), true);
  assert.equal(hours.isOpen('2024-01-08T10:30:00Z'), false);
});

test('DST gaps and repeats use compatible defaults and configurable disambiguation', () => {
  const schedule = { timeZone: 'America/New_York', weekly: { 7: [{ open: '01:30', close: '02:30' }] } };
  const compatible = new BusinessHours(schedule);
  assert.deepEqual(compatible.getOpenIntervals('2024-03-10T06:00:00Z', '2024-03-10T08:00:00Z'), [
    { start: '2024-03-10T06:30:00Z', end: '2024-03-10T07:30:00Z' },
  ]);
  assert.deepEqual(new BusinessHours({ ...schedule, disambiguation: 'later' }).getOpenIntervals('2024-11-03T04:00:00Z', '2024-11-03T08:00:00Z'), [
    { start: '2024-11-03T06:30:00Z', end: '2024-11-03T07:30:00Z' },
  ]);
  assert.deepEqual(new BusinessHours({ ...schedule, disambiguation: 'earlier' }).getOpenIntervals('2024-11-03T04:00:00Z', '2024-11-03T08:00:00Z'), [
    { start: '2024-11-03T05:30:00Z', end: '2024-11-03T07:30:00Z' },
  ]);
  assert.throws(() => new BusinessHours({ ...schedule, disambiguation: 'reject' }).getOpenIntervals('2024-03-10T06:00:00Z', '2024-03-10T08:00:00Z'), BusinessHoursError);

  const gapOpening = { timeZone: 'America/New_York', weekly: { 7: [{ open: '02:30', close: '04:00' }] } };
  assert.deepEqual(new BusinessHours(gapOpening).getOpenIntervals('2024-03-10T06:00:00Z', '2024-03-10T09:00:00Z'), [
    { start: '2024-03-10T07:30:00Z', end: '2024-03-10T08:00:00Z' },
  ]);
  assert.deepEqual(new BusinessHours({ ...gapOpening, disambiguation: 'earlier' }).getOpenIntervals('2024-03-10T06:00:00Z', '2024-03-10T09:00:00Z'), [
    { start: '2024-03-10T06:30:00Z', end: '2024-03-10T08:00:00Z' },
  ]);
});

test('full local days across New York DST changes last 23 and 25 elapsed hours', () => {
  const hours = new BusinessHours({ timeZone: 'America/New_York', weekly: { 7: [{ open: '00:00', close: '24:00' }] } });
  assert.deepEqual(hours.getOpenIntervals('2024-03-10T00:00:00Z', '2024-03-12T00:00:00Z'), [
    { start: '2024-03-10T05:00:00Z', end: '2024-03-11T04:00:00Z' },
  ]);
  assert.equal(hours.openDuration('2024-03-10T05:00:00Z', '2024-03-11T04:00:00Z'), 23 * 60 * 60 * 1000);
  const fall = hours.getOpenIntervals('2024-11-03T00:00:00Z', '2024-11-05T00:00:00Z');
  assert.deepEqual(fall, [{ start: '2024-11-03T04:00:00Z', end: '2024-11-04T05:00:00Z' }]);
  assert.equal(hours.openDuration(fall[0].start, fall[0].end), 25 * 60 * 60 * 1000);
});

test('overnight windows across DST transitions resolve both local endpoints', () => {
  const hours = new BusinessHours({ timeZone: 'America/New_York', weekly: { 6: [{ open: '23:00', close: '03:00' }] } });
  assert.deepEqual(hours.getOpenIntervals('2024-03-10T03:00:00Z', '2024-03-10T08:00:00Z'), [
    { start: '2024-03-10T04:00:00Z', end: '2024-03-10T07:00:00Z' },
  ]);
  assert.deepEqual(hours.getOpenIntervals('2024-11-03T02:00:00Z', '2024-11-03T09:00:00Z'), [
    { start: '2024-11-03T03:00:00Z', end: '2024-11-03T08:00:00Z' },
  ]);
});

test('non-hour DST changes and skipped civil days produce valid bounded intervals', () => {
  const lordHowe = new BusinessHours({ timeZone: 'Australia/Lord_Howe', weekly: { 7: [{ open: '01:45', close: '02:15' }] } });
  assert.deepEqual(lordHowe.getOpenIntervals('2024-10-05T14:30:00Z', '2024-10-05T16:00:00Z'), [
    { start: '2024-10-05T15:15:00Z', end: '2024-10-05T15:45:00Z' },
  ]);
  const apia = new BusinessHours({ timeZone: 'Pacific/Apia', weekly: { 5: [{ open: '09:00', close: '10:00' }] } });
  assert.deepEqual(apia.getOpenIntervals('2011-12-29T00:00:00Z', '2011-12-31T23:59:59Z'), []);
  for (const disambiguation of ['compatible', 'earlier', 'later', 'reject']) {
    const skipped = new BusinessHours({ timeZone: 'Pacific/Apia', weekly: { 5: [{ open: '09:00', close: '10:00' }] }, disambiguation });
    assert.deepEqual(skipped.getOpenIntervals('2011-12-29T00:00:00Z', '2011-12-31T23:59:59Z'), [], disambiguation);
  }
});

test('Kolkata and London schedules resolve local wall times in their respective zones', () => {
  const kolkata = new BusinessHours({ timeZone: 'Asia/Kolkata', weekly: { 1: [{ open: '09:00', close: '10:00' }] } });
  assert.deepEqual(kolkata.getOpenIntervals('2024-01-08T03:00:00Z', '2024-01-08T05:00:00Z'), [
    { start: '2024-01-08T03:30:00Z', end: '2024-01-08T04:30:00Z' },
  ]);
  const london = new BusinessHours({ timeZone: 'Europe/London', weekly: { 1: [{ open: '09:00', close: '10:00' }] } });
  assert.deepEqual(london.getOpenIntervals('2024-01-08T08:00:00Z', '2024-01-08T11:00:00Z'), [
    { start: '2024-01-08T09:00:00Z', end: '2024-01-08T10:00:00Z' },
  ]);
  assert.deepEqual(london.getOpenIntervals('2024-07-08T07:00:00Z', '2024-07-08T10:00:00Z'), [
    { start: '2024-07-08T08:00:00Z', end: '2024-07-08T09:00:00Z' },
  ]);
});

test('leap dates and overnight windows crossing a year boundary are handled', () => {
  const hours = new BusinessHours({ timeZone: 'UTC', weekly: { 4: [{ open: '23:00', close: '02:00' }] } });
  assert.deepEqual(hours.getOpenIntervals('2024-02-29T22:00:00Z', '2024-03-01T03:00:00Z'), [
    { start: '2024-02-29T23:00:00Z', end: '2024-03-01T02:00:00Z' },
  ]);
  const yearEnd = new BusinessHours({ timeZone: 'UTC', weekly: { 7: [{ open: '23:00', close: '02:00' }] } });
  assert.deepEqual(yearEnd.getOpenIntervals('2023-12-31T22:00:00Z', '2024-01-01T03:00:00Z'), [
    { start: '2023-12-31T23:00:00Z', end: '2024-01-01T02:00:00Z' },
  ]);
});

test('validation rejects malformed, unsafe, accessor-bearing, and oversized input', () => {
  const malformed = [
    { timeZone: 'UTC', weekly: { 1: [{ open: '9:00', close: '17:00' }] } },
    { timeZone: 'UTC', weekly: { 1: [{ open: '09:00', close: '09:00' }] } },
    { timeZone: 'UTC', weekly: { 1: [{ open: '09:00', close: '24:01' }] } },
    { timeZone: 'UTC', weekly: { 1: [{ open: '09:00', close: '10:00', extra: true }] } },
    { timeZone: 'UTC', weekly: { 1: [{ open: '09:00', close: '10:00' }] }, unrecognized: true },
  ];
  for (const config of malformed) assert.throws(() => validateSchedule(config), BusinessHoursError);

  const unsafe = JSON.parse('{"timeZone":"UTC","weekly":{"__proto__":[{"open":"09:00","close":"10:00"}]}}');
  assert.throws(() => validateSchedule(unsafe), BusinessHoursError);
  const accessor = { timeZone: 'UTC', weekly: {} };
  Object.defineProperty(accessor, 'holidays', { enumerable: true, get() { throw new Error('getter executed'); } });
  assert.throws(() => validateSchedule(accessor), BusinessHoursError);
  const symbolConfig = { timeZone: 'UTC', weekly: {} };
  Object.defineProperty(symbolConfig, Symbol('hidden'), { value: true });
  assert.throws(() => validateSchedule(symbolConfig), BusinessHoursError);
  const extraArrayProperty = [{ open: '09:00', close: '10:00' }];
  extraArrayProperty.extra = true;
  assert.throws(() => validateSchedule({ timeZone: 'UTC', weekly: { 1: extraArrayProperty } }), BusinessHoursError);
  assert.throws(() => validateSchedule({ timeZone: 'UTC', weekly: {}, holidays: Array(10001).fill('2024-01-01') }), BusinessHoursError);
  assert.throws(() => validateSchedule({ timeZone: 'UTC', weekly: { 1: Array(25).fill({ open: '09:00', close: '10:00' }) } }), BusinessHoursError);
  assert.throws(() => validateSchedule({ timeZone: 'UTC', weekly: { 1: Array(1_000_000_000) } }), BusinessHoursError);
  const manyExceptions = Object.fromEntries(Array.from({ length: 10001 }, (_, i) => {
    const date = new Date(Date.UTC(1900, 0, 1 + i)).toISOString().slice(0, 10);
    return [date, []];
  }));
  assert.throws(() => validateSchedule({ timeZone: 'UTC', weekly: { 1: Array(10).fill({ open: '09:00', close: '10:00' }) }, exceptions: manyExceptions }), BusinessHoursError);
  const manyExceptionPeriods = Object.fromEntries(Array.from({ length: 10000 }, (_, i) => {
    const date = new Date(Date.UTC(1900, 0, 1 + i)).toISOString().slice(0, 10);
    return [date, [{ open: '09:00', close: '10:00' }]];
  }));
  assert.throws(() => validateSchedule({ timeZone: 'UTC', weekly: { 1: [{ open: '09:00', close: '10:00' }] }, exceptions: manyExceptionPeriods }), BusinessHoursError);
  assert.throws(() => validateSchedule({ timeZone: 'UTC', weekly: {}, maxDays: 3661 }), BusinessHoursError);
  assert.throws(() => validateSchedule({ timeZone: 'UTC', weekly: {}, disambiguation: null }), BusinessHoursError);
  assert.throws(() => validateSchedule({ timeZone: 'UTC', weekly: {}, disambiguation: { mode: 'earlier' } }), BusinessHoursError);
});

test('holiday and exception dates validate Gregorian leap-day rules, including century years', () => {
  assert.doesNotThrow(() => validateSchedule({ timeZone: 'UTC', weekly: {}, holidays: ['2000-02-29'] }));
  assert.doesNotThrow(() => validateSchedule({ timeZone: 'UTC', weekly: {}, exceptions: { '2024-02-29': [] } }));
  for (const invalidDate of ['1900-02-29', '2023-02-29', '2100-02-29']) {
    assert.throws(() => validateSchedule({ timeZone: 'UTC', weekly: {}, holidays: [invalidDate] }), BusinessHoursError, invalidDate);
    assert.throws(() => validateSchedule({ timeZone: 'UTC', weekly: {}, exceptions: { [invalidDate]: [] } }), BusinessHoursError, invalidDate);
  }
});

test('status returns null when no opening or closing transition exists in its search horizon', () => {
  const hours = new BusinessHours(utc({}));
  assert.deepEqual(hours.getStatus('2024-01-08T10:00:00Z'), {
    isOpen: false,
    nextOpening: null,
    nextClosing: null,
  });
});

test('24/7 schedules have no upcoming opening or closing transition', () => {
  const allDay = Array.from({ length: 7 }, () => [{ open: '00:00', close: '24:00' }]);
  const weekly = Object.fromEntries(allDay.map((periods, index) => [index + 1, periods]));
  const hours = new BusinessHours(utc(weekly));
  assert.equal(hours.nextOpening('2024-01-08T12:00:00Z', { horizonDays: 3 }), null);
  assert.equal(hours.nextClosing('2024-01-08T12:00:00Z', { horizonDays: 3 }), null);
  assert.deepEqual(hours.getStatus('2024-01-08T12:00:00Z'), { isOpen: true, nextOpening: null, nextClosing: null });
});

test('triple overlaps merge into the full range where multiple periods are simultaneously active', () => {
  const hours = new BusinessHours(utc({ 1: [
    { open: '09:00', close: '13:00' },
    { open: '10:00', close: '12:00' },
    { open: '11:00', close: '14:00' },
  ] }));
  assert.deepEqual(hours.detectConflicts('2024-01-08T09:30:00Z', '2024-01-08T13:30:00Z'), [
    { start: '2024-01-08T10:00:00Z', end: '2024-01-08T13:00:00Z' },
  ]);
});
