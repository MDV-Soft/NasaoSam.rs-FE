import { FormControl, FormGroup } from '@angular/forms';
import { coordinatesValidator, lostTimeValidator } from './lost-report-validators';

describe('lostTimeValidator', () => {
  // Fiksno "sada", da test ne zavisi od sata na računaru
  const NOW = new Date('2026-11-15T12:00:00Z');
  const validator = lostTimeValidator(() => NOW);

  const makeGroup = (lostFrom: string, lostTo: string) =>
    new FormGroup({ lostFrom: new FormControl(lostFrom), lostTo: new FormControl(lostTo) });

  it('accepts a period in the past', () => {
    const group = makeGroup('2026-11-14T08:00:00Z', '2026-11-14T10:00:00Z');

    expect(validator(group)).toBeNull();
  });

  it('accepts the same moment for start and end', () => {
    const group = makeGroup('2026-11-14T08:00:00Z', '2026-11-14T08:00:00Z');

    expect(validator(group)).toBeNull();
  });

  it('rejects a start that is after the end', () => {
    const group = makeGroup('2026-11-14T10:00:00Z', '2026-11-14T08:00:00Z');

    expect(validator(group)).toEqual({ lostFromAfterLostTo: true });
  });

  it('rejects an end in the future', () => {
    const group = makeGroup('2026-11-15T11:00:00Z', '2026-11-15T13:00:00Z');

    expect(validator(group)).toEqual({ lostInFuture: true });
  });

  it('tolerates 5 minutes into the future, like the backend', () => {
    const fiveMinutes = makeGroup('2026-11-15T11:00:00Z', '2026-11-15T12:05:00Z');
    const sixMinutes = makeGroup('2026-11-15T11:00:00Z', '2026-11-15T12:06:00Z');

    expect(validator(fiveMinutes)).toBeNull();
    expect(validator(sixMinutes)).toEqual({ lostInFuture: true });
  });

  it('rejects a loss older than 365 days', () => {
    // 365 dana pre 2026-11-15 je 2025-11-15
    const justInside = makeGroup('2025-11-15T12:00:00Z', '2025-11-16T12:00:00Z');
    const tooOld = makeGroup('2025-11-15T11:59:00Z', '2025-11-16T12:00:00Z');

    expect(validator(justInside)).toBeNull();
    expect(validator(tooOld)).toEqual({ lostTooOld: true });
  });

  it('reports several problems at once', () => {
    const group = makeGroup('2026-11-16T10:00:00Z', '2026-11-14T08:00:00Z');

    expect(validator(group)).toEqual({ lostFromAfterLostTo: true });

    const wrongEverything = makeGroup('2030-01-02T00:00:00Z', '2030-01-01T00:00:00Z');
    expect(validator(wrongEverything)).toEqual({
      lostFromAfterLostTo: true,
      lostInFuture: true,
    });
  });

  it('stays silent while a field is empty (required handles that)', () => {
    expect(validator(makeGroup('', '2026-11-14T10:00:00Z'))).toBeNull();
    expect(validator(makeGroup('2026-11-14T10:00:00Z', ''))).toBeNull();
  });

  it('works with the datetime-local format (no time zone, no seconds)', () => {
    // "2026-11-14T10:30" tumači se u vremenskoj zoni računara; mnogo pre "sada", pa je uvek u redu
    const group = makeGroup('2026-11-14T08:00', '2026-11-14T10:30');

    expect(validator(group)).toBeNull();
  });
});

describe('coordinatesValidator', () => {
  const validator = coordinatesValidator();

  const makeGroup = (latitude: number | null, longitude: number | null, radius: number | null) =>
    new FormGroup({
      latitude: new FormControl(latitude),
      longitude: new FormControl(longitude),
      locationRadiusMeters: new FormControl(radius),
    });

  it('accepts no location at all', () => {
    expect(validator(makeGroup(null, null, null))).toBeNull();
  });

  it('accepts a point without a radius', () => {
    expect(validator(makeGroup(44.8, 20.4, null))).toBeNull();
  });

  it('accepts a point with a radius', () => {
    expect(validator(makeGroup(44.8, 20.4, 500))).toBeNull();
  });

  it('accepts 0 as a coordinate (it is a real value, not "empty")', () => {
    expect(validator(makeGroup(0, 0, null))).toBeNull();
  });

  it('rejects only latitude', () => {
    expect(validator(makeGroup(44.8, null, null))).toEqual({ coordinatesPair: true });
  });

  it('rejects only longitude', () => {
    expect(validator(makeGroup(null, 20.4, null))).toEqual({ coordinatesPair: true });
  });

  it('rejects a radius without a point', () => {
    expect(validator(makeGroup(null, null, 500))).toEqual({ radiusWithoutPoint: true });
  });

  it('reports both problems when there is a lone longitude and a radius', () => {
    expect(validator(makeGroup(null, 20.4, 500))).toEqual({
      coordinatesPair: true,
      radiusWithoutPoint: true,
    });
  });
});
