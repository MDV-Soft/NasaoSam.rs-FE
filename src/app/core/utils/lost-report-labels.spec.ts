import { ItemOptions } from '../models/item-options.model';
import { LostReportItem } from '../models/lost-report.model';
import {
  DEFAULT_SEARCH_RADIUS_METERS,
  findLabel,
  itemTitle,
  searchAreaText,
  statusLabel,
} from './lost-report-labels';

const OPTIONS: ItemOptions = {
  categories: [
    { value: 'WALLET', label: 'Novčanik' },
    { value: 'DOCUMENT', label: 'Dokument' },
    { value: 'OTHER', label: 'Ostalo' },
  ],
  documentTypes: [{ value: 'ID_CARD', label: 'Lična karta' }],
  colors: [{ value: 'BLACK', label: 'Crna' }],
};

// Predmet kakav stiže sa servera; zadata polja prepisuju prazne vrednosti
const item = (values: Partial<LostReportItem>): LostReportItem => ({
  id: 1,
  category: 'WALLET',
  customCategory: null,
  documentType: null,
  color: null,
  brand: null,
  material: null,
  description: null,
  distinctiveMarks: null,
  hasNameHash: false,
  hasNameDobHash: false,
  ...values,
});

describe('statusLabel', () => {
  it.each([
    ['ACTIVE', 'Aktivan'],
    ['RETURNED', 'Vraćen'],
    ['CLOSED', 'Zatvoren'],
    ['EXPIRED', 'Istekao'],
  ] as const)('%s → %s', (status, label) => {
    expect(statusLabel(status)).toBe(label);
  });
});

describe('findLabel', () => {
  it('finds the label for a value', () => {
    expect(findLabel(OPTIONS.categories, 'WALLET')).toBe('Novčanik');
  });

  it('falls back to the value itself when it is not in the list', () => {
    expect(findLabel(OPTIONS.categories, 'SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });

  it('falls back to the value while the list is not loaded yet', () => {
    expect(findLabel(undefined, 'WALLET')).toBe('WALLET');
  });

  it('returns an empty text for a missing value', () => {
    expect(findLabel(OPTIONS.categories, null)).toBe('');
  });
});

describe('itemTitle', () => {
  it('uses the category label for ordinary items', () => {
    expect(itemTitle(item({ category: 'WALLET' }), OPTIONS)).toBe('Novčanik');
  });

  it('uses the name the owner typed for "Other"', () => {
    expect(itemTitle(item({ category: 'OTHER', customCategory: 'Kišobran' }), OPTIONS)).toBe(
      'Kišobran',
    );
  });

  it('shows the document type for documents', () => {
    expect(itemTitle(item({ category: 'DOCUMENT', documentType: 'ID_CARD' }), OPTIONS)).toBe(
      'Dokument: Lična karta',
    );
  });

  it('falls back to technical values while the lists are not loaded', () => {
    expect(itemTitle(item({ category: 'DOCUMENT', documentType: 'ID_CARD' }), null)).toBe(
      'DOCUMENT: ID_CARD',
    );
  });
});

describe('searchAreaText (gde se traže nalazi)', () => {
  const area = (values: Partial<Parameters<typeof searchAreaText>[0]>) =>
    searchAreaText({
      city: 'Niš',
      latitude: null,
      longitude: null,
      locationRadiusMeters: null,
      ...values,
    });

  it('says the circle around the point, with the radius that the owner chose', () => {
    expect(area({ latitude: 43.32, longitude: 21.9, locationRadiusMeters: 300 })).toBe(
      'u krugu od 300 m oko tačke koju si označio',
    );
    expect(area({ latitude: 43.32, longitude: 21.9, locationRadiusMeters: 3000 })).toBe(
      'u krugu od 3 km oko tačke koju si označio',
    );
  });

  it('uses the radius of the backend (5 km) when the report has a point but no radius', () => {
    expect(DEFAULT_SEARCH_RADIUS_METERS).toBe(5000);
    expect(area({ latitude: 43.32, longitude: 21.9 })).toBe(
      'u krugu od 5 km oko tačke koju si označio',
    );
  });

  it('says the whole city when the report has no point (the backend then compares the city only)', () => {
    expect(area({})).toBe('bilo gde u mestu Niš (oglas nema tačku na mapi)');
  });

  it('treats a point at 0,0 as a point (0 is a real coordinate)', () => {
    expect(area({ latitude: 0, longitude: 0, locationRadiusMeters: 1000 })).toContain('1 km');
  });
});
