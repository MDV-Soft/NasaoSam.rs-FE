import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DEFAULT_RADIUS_METERS, LocationPicker, MapLocation } from './location-picker';

describe('LocationPicker', () => {
  let component: LocationPicker;
  let fixture: ComponentFixture<LocationPicker>;
  let emitted: (MapLocation | null)[];

  const page = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LocationPicker] }).compileComponents();

    fixture = TestBed.createComponent(LocationPicker);
    component = fixture.componentInstance;
    emitted = [];
    component.locationChange.subscribe((location) => emitted.push(location));
    await fixture.whenStable();
  });

  it('creates the map and asks the user to click on it', () => {
    expect(page().querySelector('.leaflet-container')).not.toBeNull();
    expect(page().textContent).toContain('Klikni na mapu');
    // Radijus se bira tek kad postoji pin
    expect(page().querySelector('.lp-radius')).toBeNull();
  });

  // Leaflet krug koji komponenta drži (privatno polje), za proveru da li postoji
  const circleOf = (picker: LocationPicker) => (picker as unknown as { circle: unknown }).circle;

  it('places a pin with the default radius and rounds to 6 decimals (like the database)', async () => {
    component.placePin(44.81254321, 20.46123456);
    await fixture.whenStable();

    expect(emitted).toEqual([
      { latitude: 44.812543, longitude: 20.461235, radiusMeters: DEFAULT_RADIUS_METERS },
    ]);
    expect(page().querySelector('.lp-pin')).not.toBeNull();
    expect(page().querySelector('.lp-radius')).not.toBeNull();
    expect(circleOf(component)).not.toBeNull();
    expect(page().textContent).not.toContain('Klikni na mapu tamo');
  });

  describe('the radius (a HARD limit: a find outside the circle is never matched)', () => {
    it('starts at 1 km, not at a small circle', async () => {
      expect(DEFAULT_RADIUS_METERS).toBe(1000);

      component.placePin(44.8, 20.4);
      await fixture.whenStable();

      expect(emitted.at(-1)?.radiusMeters).toBe(1000);
      expect(page().querySelector('.lp-chip-active')?.textContent).toContain('1 km');
    });

    it('asks how far from the pin to search, and says that finds outside the circle are not shown', async () => {
      component.placePin(44.8, 20.4);
      await fixture.whenStable();

      const radius = page().querySelector('.lp-radius')?.textContent?.replace(/\s+/g, ' ') ?? '';
      expect(radius).toContain('Koliko daleko od pina da tražimo nalaze?');
      expect(radius).toContain('Nalaze van ovog kruga ne prikazujemo');
      expect(radius).toContain('izaberi veći krug');
      expect(radius).not.toContain('Koliko si siguran');
    });

    it('still offers the small circles for owners who know where they lost the item', async () => {
      component.placePin(44.8, 20.4);
      await fixture.whenStable();

      const labels = Array.from(page().querySelectorAll('.lp-chip strong')).map(
        (e) => e.textContent,
      );
      expect(labels).toEqual(['100 m', '300 m', '1 km', '3 km']);
    });
  });

  it('keeps the chosen radius when the pin moves', async () => {
    component.placePin(44.8, 20.4);
    component.setRadius(1000);
    component.placePin(44.9, 20.5);
    await fixture.whenStable();

    expect(emitted.at(-1)).toEqual({ latitude: 44.9, longitude: 20.5, radiusMeters: 1000 });
    const active = page().querySelector('.lp-chip-active');
    expect(active?.textContent).toContain('1 km');
  });

  it('ignores a radius when there is no pin', () => {
    component.setRadius(1000);
    expect(emitted).toEqual([]);
  });

  it('shows the prompt that the page gives it', async () => {
    fixture.componentRef.setInput('prompt', 'Klikni na mapu tamo gde si našao predmet');
    await fixture.whenStable();

    expect(page().querySelector('.lp-overlay')?.textContent).toContain('gde si našao predmet');
  });

  describe('without the radius (finder)', () => {
    beforeEach(async () => {
      fixture.componentRef.setInput('showRadius', false);
      await fixture.whenStable();
    });

    it('places a pin with radius 0 and hides the radius choice and the circle', async () => {
      component.placePin(44.8, 20.4);
      await fixture.whenStable();

      expect(emitted.at(-1)).toEqual({ latitude: 44.8, longitude: 20.4, radiusMeters: 0 });
      expect(page().querySelector('.lp-pin')).not.toBeNull();
      expect(page().querySelector('.lp-radius')).toBeNull();
      // jsdom ne iscrtava Leaflet krug, pa se proverava stanje komponente
      expect(circleOf(component)).toBeNull();
    });

    it('keeps radius 0 when the pin is moved', async () => {
      component.placePin(44.8, 20.4);
      component.placePin(44.9, 20.5);

      expect(emitted.at(-1)).toEqual({ latitude: 44.9, longitude: 20.5, radiusMeters: 0 });
    });
  });

  describe('without the locate tools (finder)', () => {
    const toolTexts = () =>
      Array.from(page().querySelectorAll('.lp-tool')).map((b) => b.textContent?.trim());

    it('shows both tools by default', () => {
      expect(toolTexts()).toEqual(['Moja trenutna lokacija', 'Pin na sredinu mape']);
    });

    it('hides "my location" and "pin at the center", and shows no toolbar before a pin exists', async () => {
      fixture.componentRef.setInput('showLocateTools', false);
      await fixture.whenStable();

      expect(page().querySelector('.lp-toolbar')).toBeNull();
      expect(page().textContent).not.toContain('Moja trenutna lokacija');
      expect(page().textContent).not.toContain('Pin na sredinu mape');
    });

    it('still offers "remove pin" once a pin is placed', async () => {
      fixture.componentRef.setInput('showLocateTools', false);
      component.placePin(44.8, 20.4);
      await fixture.whenStable();

      expect(toolTexts()).toEqual(['Ukloni pin']);
    });
  });

  it('removes the pin', async () => {
    component.placePin(44.8, 20.4);
    component.clear();
    await fixture.whenStable();

    expect(emitted.at(-1)).toBeNull();
    expect(page().querySelector('.lp-pin')).toBeNull();
  });

  it('shows the location it got from the form', async () => {
    fixture.componentRef.setInput('location', {
      latitude: 43.32,
      longitude: 21.9,
      radiusMeters: 100,
    });
    await fixture.whenStable();

    expect(component.current()).toEqual({ latitude: 43.32, longitude: 21.9, radiusMeters: 100 });
    expect(page().querySelector('.lp-pin')).not.toBeNull();
    expect(page().querySelector('.lp-chip-active')?.textContent).toContain('100 m');
  });
});
