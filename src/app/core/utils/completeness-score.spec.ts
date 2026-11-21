import {
  CompletenessInput,
  CompletenessItem,
  completenessScore,
  descriptionPoints,
  emptyCompletenessItem,
  itemScore,
  precisionLevel,
  suggestions,
} from './completeness-score';

const item = (values: Partial<CompletenessItem>): CompletenessItem => ({
  ...emptyCompletenessItem(),
  ...values,
});

const report = (values: Partial<CompletenessInput>): CompletenessInput => ({
  hasPlaceDescription: false,
  hasCoordinates: false,
  hasDetails: false,
  items: [],
  ...values,
});

// Primeri su isti kao u CompletenessScoreCalculator(Test) na backendu
describe('completenessScore (isto kao backend)', () => {
  it('gives description points by length: 40 → 20, 100 → 30, 200 → 40', () => {
    expect(descriptionPoints(39)).toBe(0);
    expect(descriptionPoints(40)).toBe(20);
    expect(descriptionPoints(99)).toBe(20);
    expect(descriptionPoints(100)).toBe(30);
    expect(descriptionPoints(200)).toBe(40);
  });

  it('scores a fully described object with 100', () => {
    expect(
      itemScore(
        item({
          category: 'WALLET',
          hasColor: true,
          hasBrand: true,
          hasMaterial: true,
          hasDistinctiveMarks: true,
          descriptionLength: 250,
        }),
      ),
    ).toBe(100);
  });

  it('scores a document only by type and name hashes', () => {
    expect(itemScore(item({ category: 'DOCUMENT', hasDocumentType: true }))).toBe(30);
    expect(
      itemScore(item({ category: 'DOCUMENT', hasDocumentType: true, hasNameHash: true })),
    ).toBe(70);
    expect(
      itemScore(
        item({
          category: 'DOCUMENT',
          hasDocumentType: true,
          hasNameHash: true,
          hasNameDobHash: true,
          // Ne broji se kod dokumenta
          hasColor: true,
          descriptionLength: 300,
        }),
      ),
    ).toBe(100);
  });

  it('matches the backend example: place description (10) + a wallet scored 80 → 66', () => {
    const wallet = item({
      category: 'WALLET',
      hasColor: true,
      hasBrand: true,
      hasDistinctiveMarks: true,
      descriptionLength: 120, // 15 + 15 + 20 + 30 = 80
    });
    expect(itemScore(wallet)).toBe(80);
    expect(completenessScore(report({ hasPlaceDescription: true, items: [wallet] }))).toBe(66);
  });

  it('returns only report points when there are no items', () => {
    expect(
      completenessScore(
        report({ hasPlaceDescription: true, hasCoordinates: true, hasDetails: true }),
      ),
    ).toBe(30);
  });

  it('uses the average of the items, rounding half up', () => {
    // (100 + 15) * 70 / 200 = 40.25 → 40
    const full = item({
      category: 'DOCUMENT',
      hasDocumentType: true,
      hasNameHash: true,
      hasNameDobHash: true,
    });
    const weak = item({ category: 'KEYS', hasColor: true });
    expect(completenessScore(report({ items: [full, weak] }))).toBe(40);

    // 50 * 70 / 100 = 35 ; 15 * 70 / 100 = 10.5 → 11
    expect(completenessScore(report({ items: [item({ category: 'KEYS', hasColor: true })] }))).toBe(
      11,
    );
  });

  it('never goes above 100', () => {
    const full = item({
      category: 'DOCUMENT',
      hasDocumentType: true,
      hasNameHash: true,
      hasNameDobHash: true,
    });
    expect(
      completenessScore(
        report({
          hasPlaceDescription: true,
          hasCoordinates: true,
          hasDetails: true,
          items: [full],
        }),
      ),
    ).toBe(100);
  });
});

describe('suggestions', () => {
  it('lists the missing fields with the exact gain, the biggest first', () => {
    const input = report({ items: [item({ category: 'WALLET', descriptionLength: 45 })] });
    const list = suggestions(input);

    // Opis 45 → 100 znakova: predmet 20 → 30, ukupno 14 → 21 (+7)
    expect(list.find((s) => s.key === 'items.0.description')?.gain).toBe(7);
    // Posebni znaci: predmet 20 → 40, ukupno 14 → 28 (+14)
    expect(list.find((s) => s.key === 'items.0.distinctiveMarks')?.gain).toBe(14);
    expect(list.find((s) => s.key === 'coordinates')?.gain).toBe(10);
    expect(list[0].key).toBe('items.0.distinctiveMarks');

    const gains = list.map((s) => s.gain);
    expect(gains).toEqual([...gains].sort((a, b) => b - a));
  });

  it('does not suggest what is already filled in', () => {
    const list = suggestions(
      report({
        hasCoordinates: true,
        items: [item({ category: 'WALLET', hasColor: true, descriptionLength: 250 })],
      }),
    );
    const keys = list.map((s) => s.key);

    expect(keys).not.toContain('coordinates');
    expect(keys).not.toContain('items.0.color');
    expect(keys).not.toContain('items.0.description');
  });

  it('suggests document fields only for documents', () => {
    const keys = suggestions(report({ items: [item({ category: 'DOCUMENT' })] })).map((s) => s.key);

    expect(keys).toContain('items.0.name');
    expect(keys).toContain('items.0.documentType');
    expect(keys).not.toContain('items.0.color');
  });

  it('suggests nothing for an item without a category', () => {
    const keys = suggestions(report({ items: [item({})] })).map((s) => s.key);
    expect(keys.some((k) => k.startsWith('items.'))).toBe(false);
  });

  it('is empty when the report is complete', () => {
    const full = item({
      category: 'DOCUMENT',
      hasDocumentType: true,
      hasNameHash: true,
      hasNameDobHash: true,
    });
    expect(
      suggestions(
        report({
          hasPlaceDescription: true,
          hasCoordinates: true,
          hasDetails: true,
          items: [full],
        }),
      ),
    ).toEqual([]);
  });
});

describe('precisionLevel', () => {
  it('maps the score to a level', () => {
    expect(precisionLevel(0).tone).toBe('low');
    expect(precisionLevel(39).tone).toBe('low');
    expect(precisionLevel(40).tone).toBe('medium');
    expect(precisionLevel(70).tone).toBe('good');
    expect(precisionLevel(90).tone).toBe('great');
  });
});
