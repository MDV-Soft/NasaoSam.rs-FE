import { FormControl, FormGroup } from '@angular/forms';
import { foundTimeValidator, handoverValidator } from './found-report-validators';

describe('foundTimeValidator', () => {
  const NOW = new Date('2026-11-20T12:00:00.000Z');
  const validator = foundTimeValidator(() => NOW);
  const run = (iso: string) => validator(new FormControl(iso));
  const hoursFromNow = (hours: number): string =>
    new Date(NOW.getTime() + hours * 60 * 60 * 1000).toISOString();

  it('accepts a time in the past', () => {
    expect(run(hoursFromNow(-3))).toBeNull();
  });

  it('accepts "now" and up to 5 minutes ahead (clock differences)', () => {
    expect(run(NOW.toISOString())).toBeNull();
    expect(run(new Date(NOW.getTime() + 4 * 60 * 1000).toISOString())).toBeNull();
  });

  it('rejects a time in the future', () => {
    expect(run(new Date(NOW.getTime() + 6 * 60 * 1000).toISOString())).toEqual({
      foundInFuture: true,
    });
  });

  it('accepts exactly 30 days ago and rejects older', () => {
    expect(run(hoursFromNow(-30 * 24))).toBeNull();
    expect(run(hoursFromNow(-30 * 24 - 1))).toEqual({ foundTooOld: true });
  });

  it('lets an empty or unreadable value through (Validators.required handles it)', () => {
    expect(run('')).toBeNull();
    expect(run('nije datum')).toBeNull();
  });
});

describe('handoverValidator', () => {
  const validator = handoverValidator();
  const makeGroup = (itemLocation: string, handoverInfo: string) =>
    new FormGroup({
      itemLocation: new FormControl(itemLocation),
      handoverInfo: new FormControl(handoverInfo),
    });

  it('accepts an item that is with the finder without handover info', () => {
    expect(validator(makeGroup('WITH_FINDER', ''))).toBeNull();
  });

  it('requires handover info when the item is at an institution or the police', () => {
    expect(validator(makeGroup('AT_INSTITUTION', ''))).toEqual({ handoverRequired: true });
    expect(validator(makeGroup('AT_POLICE', '   '))).toEqual({ handoverRequired: true });
  });

  it('accepts handover info when the item is not with the finder', () => {
    expect(validator(makeGroup('AT_POLICE', 'PS Vračar, Njegoševa 20, non-stop'))).toBeNull();
  });

  it('does not complain before a location is chosen (the radio field is required itself)', () => {
    expect(validator(makeGroup('', ''))).toBeNull();
  });
});
