import {
  buildNameDobKey,
  buildNameKey,
  hashDocumentName,
  normalizeDateOfBirth,
  normalizeName,
  sha256Hex,
} from './name-hash';

describe('normalizeName', () => {
  it.each([
    ['Petrović', 'petrovic'],
    ['Đorđe', 'djordje'],
    ['Šćepanović', 'scepanovic'],
    ['Žarko', 'zarko'],
    ['Čačak', 'cacak'],
    ['PETROVIĆ', 'petrovic'],
    ['petrovic', 'petrovic'],
  ])('latin %s → %s', (input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });

  it.each([
    ['Петровић', 'petrovic'],
    ['Ђорђе', 'djordje'],
    ['Љубица', 'ljubica'],
    ['Његош', 'njegos'],
    ['Џон', 'dzon'],
    ['Жарко', 'zarko'],
    ['Шћепановић', 'scepanovic'],
    ['ЧАЧАК', 'cacak'],
  ])('cyrillic %s → %s', (input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });

  it('gives the same result for cyrillic and latin spelling of the same name', () => {
    expect(normalizeName('Џонић')).toBe(normalizeName('Džonić'));
    expect(normalizeName('Љиљана')).toBe(normalizeName('Ljiljana'));
    expect(normalizeName('Ђорђе')).toBe(normalizeName('Đorđe'));
  });

  it('handles letters typed as base letter + combining mark', () => {
    // "c" + U+0301 (kombinovana oštra kvačica) izgleda kao "ć", ali su to dva znaka
    expect(normalizeName('Petrovic\u0301')).toBe('petrovic');
    expect(normalizeName('S\u030Cc\u0301epanovic\u0301')).toBe('scepanovic');
  });

  it('trims and collapses whitespace', () => {
    expect(normalizeName('  Marija   Ana  ')).toBe('marija ana');
    expect(normalizeName('Marija\t\u00A0Ana')).toBe('marija ana');
  });

  it('keeps characters it has no rule for (hyphen)', () => {
    expect(normalizeName('Petrović-Njegoš')).toBe('petrovic-njegos');
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName('   ')).toBe('');
  });
});

describe('normalizeDateOfBirth', () => {
  it('accepts a valid date', () => {
    expect(normalizeDateOfBirth('1999-05-14')).toBe('1999-05-14');
    expect(normalizeDateOfBirth(' 1999-05-14 ')).toBe('1999-05-14');
  });

  it('accepts 29 February in a leap year only', () => {
    expect(normalizeDateOfBirth('2000-02-29')).toBe('2000-02-29');
    expect(() => normalizeDateOfBirth('1999-02-29')).toThrow();
  });

  it.each(['14.05.1999', '1999/05/14', '99-05-14', '1999-5-14', '', 'abc'])(
    'rejects the wrong format "%s"',
    (value) => {
      expect(() => normalizeDateOfBirth(value)).toThrow('GGGG-MM-DD');
    },
  );

  it.each(['1999-02-30', '1999-13-01', '1999-00-10', '1999-04-31'])(
    'rejects the date that does not exist "%s"',
    (value) => {
      expect(() => normalizeDateOfBirth(value)).toThrow('ne postoji');
    },
  );
});

describe('buildNameKey and buildNameDobKey', () => {
  it('builds "lastname|firstname" (lastname first)', () => {
    expect(buildNameKey('Петровић', 'Ђорђе')).toBe('petrovic|djordje');
  });

  it('builds "lastname|firstname|yyyy-mm-dd" (example from the backend README)', () => {
    expect(buildNameDobKey('Петровић', 'Ђорђе', '1999-05-14')).toBe('petrovic|djordje|1999-05-14');
  });

  it('refuses an empty first name or last name', () => {
    expect(() => buildNameKey('', 'Đorđe')).toThrow('obavezni');
    expect(() => buildNameKey('Petrović', '   ')).toThrow('obavezni');
  });
});

describe('sha256Hex', () => {
  // Poznate vrednosti, izračunate nezavisnim alatom (Python hashlib)
  it('hashes "abc" correctly', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('hashes the empty string correctly', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('returns 64 lowercase hex characters (what the backend accepts)', async () => {
    expect(await sha256Hex('bilo šta')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes non-ASCII text as UTF-8', async () => {
    const withDiacritic = await sha256Hex('đ');
    const withoutDiacritic = await sha256Hex('dj');
    expect(withDiacritic).not.toBe(withoutDiacritic);
  });
});

describe('hashDocumentName', () => {
  const HASH_NAME = '63a91cca7f4cd75979029696f860e2b51331fd66ea748a278a1866a5073798ed';
  const HASH_NAME_DOB = '13d3022879cde05143657d2bd87929c817d6a06e443b32363175ea05678f120d';

  it('produces the exact hashes for the README example', async () => {
    const result = await hashDocumentName('Петровић', 'Ђорђе', '1999-05-14');

    expect(result.nameHash).toBe(HASH_NAME); // SHA-256("petrovic|djordje")
    expect(result.nameDobHash).toBe(HASH_NAME_DOB); // SHA-256("petrovic|djordje|1999-05-14")
  });

  it('gives the same hashes no matter how the name is written', async () => {
    const fromCyrillic = await hashDocumentName('Петровић', 'Ђорђе', '1999-05-14');
    const fromLatin = await hashDocumentName('Petrović', 'Đorđe', '1999-05-14');
    const fromAscii = await hashDocumentName('  PETROVIC ', 'djordje', '1999-05-14');

    expect(fromLatin).toEqual(fromCyrillic);
    expect(fromAscii).toEqual(fromCyrillic);
  });

  it('does not create a date hash when there is no date of birth (bank card)', async () => {
    const result = await hashDocumentName('Petrović', 'Đorđe');

    expect(result.nameHash).toBe(HASH_NAME);
    expect(result.nameDobHash).toBeUndefined();
    expect('nameDobHash' in result).toBe(false);
  });

  it.each([null, undefined, '', '   '])('treats %j as "no date of birth"', async (value) => {
    const result = await hashDocumentName('Petrović', 'Đorđe', value);

    expect(result.nameDobHash).toBeUndefined();
  });

  it('gives a different hash when first name and last name are swapped', async () => {
    const swapped = await hashDocumentName('Đorđe', 'Petrović');

    expect(swapped.nameHash).toBe(
      'aee28a73e0e5df1d4a0830e1ed0ef408806f6fa1a53e99cc5ad3be0a0e6dd614',
    );
    expect(swapped.nameHash).not.toBe(HASH_NAME);
  });

  it('gives a different date hash for a different date', async () => {
    const other = await hashDocumentName('Petrović', 'Đorđe', '1999-05-15');

    expect(other.nameHash).toBe(HASH_NAME); // isto ime, isti heš imena
    expect(other.nameDobHash).not.toBe(HASH_NAME_DOB);
  });

  it('rejects an empty name and an invalid date', async () => {
    await expect(hashDocumentName('', 'Đorđe')).rejects.toThrow('obavezni');
    await expect(hashDocumentName('Petrović', 'Đorđe', '14.05.1999')).rejects.toThrow('GGGG-MM-DD');
  });
});
