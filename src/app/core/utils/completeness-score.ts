import { ItemCategory } from '../models/lost-report.model';

/**
 * Preciznost (kompletnost) oglasa, od 0 do 100.
 *
 * ISTA PRAVILA kao CompletenessScoreCalculator na backendu: broj koji korisnik vidi dok
 * popunjava formu je isti broj koji backend upiše u bazu. Ako se tamo promene težine,
 * moraju da se promene i ovde (i testovi u completeness-score.spec.ts).
 *
 *   - do 30 bodova za ceo oglas: opis mesta, tačka na mapi, detaljan opis (po 10)
 *   - do 70 bodova za predmete: prosek ocena svih predmeta (0-100) puta 0,7
 */
export const SCORE_POINTS = {
  placeDescription: 10,
  coordinates: 10,
  details: 10,
  itemsMax: 70,

  // Predmeti koji nisu dokumenta (zbir 100)
  color: 15,
  brand: 15,
  material: 10,
  distinctiveMarks: 20,
  descriptionShort: 20, // 40+ znakova
  descriptionMedium: 30, // 100+ znakova
  descriptionLong: 40, // 200+ znakova

  // Dokumenta (zbir 100)
  documentType: 30,
  nameHash: 40,
  nameDobHash: 30,
} as const;

// Pragovi dužine opisa (u znakovima, bez razmaka sa krajeva)
export const DESCRIPTION_TIERS = [40, 100, 200] as const;

// Ono što kalkulator treba da zna o jednom predmetu (samo DA LI je nešto popunjeno)
export interface CompletenessItem {
  category: ItemCategory | '';
  hasDocumentType: boolean;
  hasNameHash: boolean;
  hasNameDobHash: boolean;
  hasColor: boolean;
  hasBrand: boolean;
  hasMaterial: boolean;
  hasDistinctiveMarks: boolean;
  descriptionLength: number;
}

export interface CompletenessInput {
  hasPlaceDescription: boolean;
  hasCoordinates: boolean;
  hasDetails: boolean;
  items: CompletenessItem[];
}

export function emptyCompletenessItem(): CompletenessItem {
  return {
    category: '',
    hasDocumentType: false,
    hasNameHash: false,
    hasNameDobHash: false,
    hasColor: false,
    hasBrand: false,
    hasMaterial: false,
    hasDistinctiveMarks: false,
    descriptionLength: 0,
  };
}

// Bodovi za opis po dužini: 40+ → 20, 100+ → 30, 200+ → 40
export function descriptionPoints(length: number): number {
  if (length >= 200) {
    return SCORE_POINTS.descriptionLong;
  }
  if (length >= 100) {
    return SCORE_POINTS.descriptionMedium;
  }
  if (length >= 40) {
    return SCORE_POINTS.descriptionShort;
  }
  return 0;
}

// Ocena jednog predmeta, 0-100
export function itemScore(item: CompletenessItem): number {
  if (item.category === 'DOCUMENT') {
    return (
      (item.hasDocumentType ? SCORE_POINTS.documentType : 0) +
      (item.hasNameHash ? SCORE_POINTS.nameHash : 0) +
      (item.hasNameDobHash ? SCORE_POINTS.nameDobHash : 0)
    );
  }

  return (
    (item.hasColor ? SCORE_POINTS.color : 0) +
    (item.hasBrand ? SCORE_POINTS.brand : 0) +
    (item.hasMaterial ? SCORE_POINTS.material : 0) +
    (item.hasDistinctiveMarks ? SCORE_POINTS.distinctiveMarks : 0) +
    descriptionPoints(item.descriptionLength)
  );
}

// Ocena celog oglasa, 0-100 (zaokruživanje kao na backendu: celobrojno, pola ide naviše)
export function completenessScore(input: CompletenessInput): number {
  let reportPoints = 0;
  if (input.hasPlaceDescription) {
    reportPoints += SCORE_POINTS.placeDescription;
  }
  if (input.hasCoordinates) {
    reportPoints += SCORE_POINTS.coordinates;
  }
  if (input.hasDetails) {
    reportPoints += SCORE_POINTS.details;
  }

  if (input.items.length === 0) {
    return reportPoints;
  }

  const itemsTotal = input.items.reduce((sum, item) => sum + itemScore(item), 0);
  const denominator = input.items.length * 100;
  const itemsPoints = Math.floor(
    (itemsTotal * SCORE_POINTS.itemsMax + Math.floor(denominator / 2)) / denominator,
  );

  return Math.min(100, reportPoints + itemsPoints);
}

// ---------------- Predlozi: šta korisnik još može da doda ----------------

/**
 * Jedan predlog: polje koje nije popunjeno i za koliko bi ga to podiglo ukupnu ocenu.
 * key je isti kao u formi, npr. "coordinates" ili "items.0.brand", da šablon pored
 * polja može da pokaže "+N".
 */
export interface Suggestion {
  key: string;
  itemIndex: number | null;
  label: string;
  gain: number;
}

type ItemChange = (item: CompletenessItem) => CompletenessItem | null;

// Koraci koji važe za predmet, po vrsti. null = ne važi (npr. već popunjeno).
function itemChanges(
  item: CompletenessItem,
): { field: string; label: string; change: ItemChange }[] {
  if (item.category === 'DOCUMENT') {
    return [
      {
        field: 'documentType',
        label: 'izaberi vrstu dokumenta',
        change: (i) => (i.hasDocumentType ? null : { ...i, hasDocumentType: true }),
      },
      {
        field: 'name',
        label: 'upiši ime i prezime sa dokumenta',
        change: (i) => (i.hasNameHash ? null : { ...i, hasNameHash: true }),
      },
      {
        field: 'dateOfBirth',
        label: 'dodaj datum rođenja sa dokumenta',
        change: (i) => (i.hasNameDobHash ? null : { ...i, hasNameDobHash: true }),
      },
    ];
  }

  // Bez izabrane vrste predmet nema polja koja mogu da se popune
  if (item.category === '') {
    return [];
  }

  return [
    {
      field: 'description',
      label: describeNextTier(item.descriptionLength),
      change: (i) => {
        const next = DESCRIPTION_TIERS.find((tier) => tier > i.descriptionLength);
        return next === undefined ? null : { ...i, descriptionLength: next };
      },
    },
    {
      field: 'distinctiveMarks',
      label: 'navedi posebne znake (nalepnica, ogrebotina, privezak)',
      change: (i) => (i.hasDistinctiveMarks ? null : { ...i, hasDistinctiveMarks: true }),
    },
    {
      field: 'color',
      label: 'izaberi boju',
      change: (i) => (i.hasColor ? null : { ...i, hasColor: true }),
    },
    {
      field: 'brand',
      label: 'upiši marku',
      change: (i) => (i.hasBrand ? null : { ...i, hasBrand: true }),
    },
    {
      field: 'material',
      label: 'upiši materijal',
      change: (i) => (i.hasMaterial ? null : { ...i, hasMaterial: true }),
    },
  ];
}

function describeNextTier(length: number): string {
  const next = DESCRIPTION_TIERS.find((tier) => tier > length);
  if (next === undefined) {
    return 'opis je dovoljno detaljan';
  }
  return 'dopuni opis do ' + next + ' znakova (još ' + (next - length) + ')';
}

/**
 * Svi koraci koji bi podigli ocenu, od najvrednijeg ka najmanje vrednom.
 * Dobitak se računa tačno: ocena SA tim poljem minus trenutna ocena.
 */
export function suggestions(input: CompletenessInput): Suggestion[] {
  const current = completenessScore(input);
  const result: Suggestion[] = [];

  const reportFields: {
    key: string;
    label: string;
    has: boolean;
    patch: Partial<CompletenessInput>;
  }[] = [
    {
      key: 'coordinates',
      label: 'obeleži mesto na mapi',
      has: input.hasCoordinates,
      patch: { hasCoordinates: true },
    },
    {
      key: 'details',
      label: 'napiši detaljan opis (šta je bilo unutra, oštećenja...)',
      has: input.hasDetails,
      patch: { hasDetails: true },
    },
    {
      key: 'placeDescription',
      label: 'opiši mesto (npr. autobus 26, kafić kod pijace)',
      has: input.hasPlaceDescription,
      patch: { hasPlaceDescription: true },
    },
  ];

  reportFields.forEach((field) => {
    if (!field.has) {
      const gain = completenessScore({ ...input, ...field.patch }) - current;
      result.push({ key: field.key, itemIndex: null, label: field.label, gain });
    }
  });

  input.items.forEach((item, index) => {
    itemChanges(item).forEach(({ field, label, change }) => {
      const changed = change(item);
      if (changed === null) {
        return;
      }
      const items = input.items.map((other, i) => (i === index ? changed : other));
      const gain = completenessScore({ ...input, items }) - current;
      result.push({ key: 'items.' + index + '.' + field, itemIndex: index, label, gain });
    });
  });

  // Stabilno sortiranje: kod istog dobitka ostaje redosled iz liste iznad
  return result.filter((s) => s.gain > 0).sort((a, b) => b.gain - a.gain);
}

// ---------------- Nivoi preciznosti, za prikaz ----------------

export interface PrecisionLevel {
  label: string;
  message: string;
  tone: 'low' | 'medium' | 'good' | 'great';
}

export function precisionLevel(score: number): PrecisionLevel {
  if (score >= 90) {
    return {
      label: 'Odlično',
      message: 'Oglas je vrlo detaljan. Imaš najveće šanse da te sistem spoji sa nalazačem.',
      tone: 'great',
    };
  }
  if (score >= 70) {
    return {
      label: 'Vrlo precizno',
      message: 'Dobar oglas. Još par detalja i biće među najpreciznijima.',
      tone: 'good',
    };
  }
  if (score >= 40) {
    return {
      label: 'Solidno',
      message: 'Sistem može da te poveže sa nalazom, ali mu fale detalji da bude siguran.',
      tone: 'medium',
    };
  }
  return {
    label: 'Slabo',
    message: 'Ovakav oglas se teško poklopi sa nađenim predmetom. Dodaj još detalja.',
    tone: 'low',
  };
}
