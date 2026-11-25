import {
  addDays,
  describeDay,
  describeMoment,
  earlierDayOptions,
  formatLocalDate,
  formatLocalDateTime,
  parseLocalDate,
  partsFromValue,
  roundDownToStep,
  valueFromParts,
} from './moment';

// Nedelja, 22. novembar 2026, 14:48 (lokalno vreme)
const NOW = new Date(2026, 10, 22, 14, 48);

describe('moment utils', () => {
  it('formats a local date and a local date with time', () => {
    expect(formatLocalDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(formatLocalDateTime(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
  });

  it('moves a day by whole days, also across month and year borders', () => {
    expect(formatLocalDate(addDays(new Date(2026, 0, 1), -1))).toBe('2025-12-31');
    expect(formatLocalDate(addDays(new Date(2026, 2, 1), -1))).toBe('2026-02-28');
  });

  it('rounds "now" down to 5 minutes, never up (so it is never in the future)', () => {
    expect(formatLocalDateTime(roundDownToStep(NOW))).toBe('2026-11-22T14:45');
    expect(formatLocalDateTime(roundDownToStep(new Date(2026, 10, 22, 14, 59)))).toBe(
      '2026-11-22T14:55',
    );
    expect(formatLocalDateTime(roundDownToStep(new Date(2026, 10, 22, 14, 0)))).toBe(
      '2026-11-22T14:00',
    );
  });

  describe('partsFromValue', () => {
    it('recognizes today and yesterday', () => {
      expect(partsFromValue('2026-11-22T10:30', NOW)).toEqual({
        day: 'today',
        date: '2026-11-22',
        hour: 10,
        minute: 30,
      });
      expect(partsFromValue('2026-11-21T23:55', NOW).day).toBe('yesterday');
    });

    it('treats any older day as "earlier" and keeps its date', () => {
      expect(partsFromValue('2026-11-14T18:00', NOW)).toEqual({
        day: 'earlier',
        date: '2026-11-14',
        hour: 18,
        minute: 0,
      });
    });

    it('lowers minutes to the step, because only those can be chosen', () => {
      expect(partsFromValue('2026-11-22T10:48', NOW).minute).toBe(45);
    });

    it('uses "now" for an empty or broken value', () => {
      for (const value of ['', 'nije datum', '2026-11-22']) {
        expect(partsFromValue(value, NOW)).toEqual({
          day: 'today',
          date: '2026-11-22',
          hour: 14,
          minute: 45,
        });
      }
    });
  });

  it('puts the parts back together in the datetime-local form', () => {
    expect(valueFromParts({ day: 'today', date: '2026-11-22', hour: 9, minute: 5 })).toBe(
      '2026-11-22T09:05',
    );
  });

  describe('earlierDayOptions', () => {
    it('offers the days from the day before yesterday back to the limit', () => {
      const options = earlierDayOptions(NOW, 30);

      expect(options.length).toBe(29);
      expect(options[0].value).toBe('2026-11-20');
      expect(options[28].value).toBe('2026-10-23'); // 30 dana pre 22. novembra
    });

    it('labels a day with its weekday and date, starting with a capital letter', () => {
      const first = earlierDayOptions(NOW, 30)[0];

      expect(first.label).toMatch(/^[A-ZČĆŠŽĐ]/);
      expect(first.label).toContain('20. novembar');
    });

    it('offers nothing when the limit is yesterday or less', () => {
      expect(earlierDayOptions(NOW, 1)).toEqual([]);
    });
  });

  describe('describeMoment', () => {
    it('writes "Danas" and "Juče" in front of the date', () => {
      expect(describeMoment('2026-11-22T14:50', NOW)).toBe('Danas, 22. novembar 2026. u 14:50');
      expect(describeMoment('2026-11-21T09:15', NOW)).toBe('Juče, 21. novembar 2026. u 09:15');
    });

    it('writes the weekday for an older day', () => {
      const text = describeMoment('2026-11-14T18:00', NOW);

      expect(text).toMatch(/^[A-ZČĆŠŽĐ]/);
      expect(text).toContain('14. novembar 2026.');
      expect(text).toContain('u 18:00');
      expect(text).not.toContain('Danas');
    });
  });

  describe('parseLocalDate', () => {
    it('reads a day as a LOCAL date, so the day never moves around midnight', () => {
      const date = parseLocalDate('2026-11-25');

      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(10);
      expect(date.getDate()).toBe(25);
      expect(date.getHours()).toBe(0);
    });
  });

  describe('describeDay', () => {
    it('says "danas" and "juče" for the last two days', () => {
      expect(describeDay('2026-11-22', NOW)).toBe('danas');
      expect(describeDay('2026-11-21', NOW)).toBe('juče');
    });

    it('writes the whole date for an older day', () => {
      expect(describeDay('2026-11-14', NOW)).toBe('14. novembar 2026.');
    });
  });
});
