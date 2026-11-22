import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MomentPicker } from './moment-picker';

// Nedelja, 22. novembar 2026, 14:48 (lokalno vreme); samo Date je lažan, ostalo radi normalno
const NOW = new Date(2026, 10, 22, 14, 48);

describe('MomentPicker', () => {
  let component: MomentPicker;
  let fixture: ComponentFixture<MomentPicker>;
  let emitted: string[];

  const page = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => page().textContent?.replace(/\s+/g, ' ') ?? '';
  const settle = () => fixture.whenStable();

  const dayButtons = (): HTMLButtonElement[] =>
    Array.from(page().querySelectorAll<HTMLButtonElement>('.mp-chip'));
  const activeDay = (): string | undefined =>
    dayButtons()
      .find((b) => b.classList.contains('mp-chip-active'))
      ?.textContent?.trim();
  const timeSelects = (): HTMLSelectElement[] =>
    Array.from(page().querySelectorAll<HTMLSelectElement>('.mp-field select'));
  const dateSelect = (): HTMLSelectElement | null =>
    page().querySelector<HTMLSelectElement>('.mp-date');

  // Izbor u padajućoj listi, kao što bi uradio korisnik
  const choose = async (select: HTMLSelectElement, value: string) => {
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await settle();
  };
  const clickDay = async (label: string) => {
    dayButtons()
      .find((b) => b.textContent?.trim() === label)
      ?.click();
    await settle();
  };

  const setup = async (inputs: Record<string, unknown> = {}) => {
    fixture = TestBed.createComponent(MomentPicker);
    component = fixture.componentInstance;
    emitted = [];
    component.valueChange.subscribe((value) => emitted.push(value));
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    await settle();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    await TestBed.configureTestingModule({ imports: [MomentPicker] }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts from "now" (rounded down to 5 minutes) when it has no value', async () => {
    await setup();

    expect(activeDay()).toBe('Danas');
    expect(timeSelects()[0].selectedOptions[0].textContent?.trim()).toBe('14');
    expect(timeSelects()[1].selectedOptions[0].textContent?.trim()).toBe('45');
    expect(text()).toContain('Danas, 22. novembar 2026. u 14:45');
  });

  it('does not use the native datetime field at all', async () => {
    await setup();

    expect(page().querySelector('input')).toBeNull();
  });

  it('shows the value it gets: yesterday at 09:15', async () => {
    await setup({ value: '2026-11-21T09:15' });

    expect(activeDay()).toBe('Juče');
    expect(timeSelects()[0].selectedOptions[0].textContent?.trim()).toBe('09');
    expect(timeSelects()[1].selectedOptions[0].textContent?.trim()).toBe('15');
    expect(text()).toContain('Juče, 21. novembar 2026. u 09:15');
  });

  it('offers 24 hours, minutes in steps of 5, and the days up to the limit under "Ranije"', async () => {
    await setup();
    expect(timeSelects()[0].options.length).toBe(24);
    expect(timeSelects()[1].options.length).toBe(12);

    await clickDay('Ranije');
    // od prekjuče do pre 30 dana
    expect(dateSelect()?.options.length).toBe(29);
    expect(dateSelect()?.options[0].value).toBe('2026-11-20');
    expect(dateSelect()?.options[0].textContent).toContain('20. novembar');
  });

  it('switches to yesterday and keeps the time', async () => {
    await setup();

    await clickDay('Juče');

    expect(emitted).toEqual(['2026-11-21T14:45']);
    expect(activeDay()).toBe('Juče');
    expect(text()).toContain('Juče, 21. novembar 2026. u 14:45');
  });

  it('switches back to today', async () => {
    await setup({ value: '2026-11-21T09:15' });

    await clickDay('Danas');

    expect(emitted).toEqual(['2026-11-22T09:15']);
    expect(activeDay()).toBe('Danas');
  });

  it('opens the list of days under "Ranije" and starts with the day before yesterday', async () => {
    await setup();
    expect(dateSelect()).toBeNull();

    await clickDay('Ranije');

    expect(emitted).toEqual(['2026-11-20T14:45']);
    expect(dateSelect()).not.toBeNull();
    expect(activeDay()).toBe('Ranije');
  });

  it('emits the day chosen from the list and shows it in the sentence', async () => {
    await setup();
    await clickDay('Ranije');

    await choose(dateSelect()!, '2026-11-14');

    expect(emitted.at(-1)).toBe('2026-11-14T14:45');
    const sentence = page().querySelector('.mp-summary')?.textContent ?? '';
    expect(sentence).toContain('14. novembar 2026. u 14:45');
    expect(sentence).not.toContain('Danas');
  });

  it('remembers the day from the list when the user goes to "Juče" and back to "Ranije"', async () => {
    await setup();
    await clickDay('Ranije');
    await choose(dateSelect()!, '2026-11-14');

    await clickDay('Juče');
    await clickDay('Ranije');

    expect(emitted.at(-1)).toBe('2026-11-14T14:45');
    expect(dateSelect()?.value).toBe('2026-11-14');
  });

  it('emits when the hour or the minutes change', async () => {
    await setup();

    await choose(timeSelects()[0], '18');
    await choose(timeSelects()[1], '30');

    expect(emitted).toEqual(['2026-11-22T18:45', '2026-11-22T18:30']);
    expect(text()).toContain('Danas, 22. novembar 2026. u 18:30');
  });

  it('follows a new value from the parent', async () => {
    await setup({ value: '2026-11-22T10:00' });
    expect(text()).toContain('u 10:00');

    fixture.componentRef.setInput('value', '2026-11-14T18:30');
    await settle();

    expect(activeDay()).toBe('Ranije');
    expect(dateSelect()?.value).toBe('2026-11-14');
    expect(text()).toContain('u 18:30');
  });

  it('does not offer "Ranije" when the limit is yesterday', async () => {
    await setup({ maxDaysBack: 1 });

    expect(dayButtons().map((b) => b.textContent?.trim())).toEqual(['Danas', 'Juče']);
  });

  it('marks the chosen day for assistive technology', async () => {
    await setup();

    expect(dayButtons().map((b) => b.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    await clickDay('Juče');
    expect(dayButtons().map((b) => b.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
  });
});
