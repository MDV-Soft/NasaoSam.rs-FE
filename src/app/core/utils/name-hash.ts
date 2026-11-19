/**
 * Heš imena sa dokumenta, po dogovoru sa backendom (README, "heš imena sa dokumenta").
 *
 * Pravo ime nikad ne napušta browser: server dobija samo SHA-256 heš.
 * Heš je isti samo ako je ulaz isti SLOVO ZA SLOVO, zato se ime pre heširanja
 * uvek svodi na isti oblik (normalizacija).
 */

// Srpska ćirilica u latinicu (sa kvačicama; kvačice se skidaju u sledećem koraku).
// Ključevi su mala slova, jer se tekst prvo pretvara u mala slova.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  ђ: 'đ',
  е: 'e',
  ж: 'ž',
  з: 'z',
  и: 'i',
  ј: 'j',
  к: 'k',
  л: 'l',
  љ: 'lj',
  м: 'm',
  н: 'n',
  њ: 'nj',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  ћ: 'ć',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'č',
  џ: 'dž',
  ш: 'š',
};

// Skidanje kvačica: č, ć → c; š → s; ž → z; đ → dj
const REMOVE_DIACRITICS: Record<string, string> = {
  č: 'c',
  ć: 'c',
  š: 's',
  ž: 'z',
  đ: 'dj',
};

/**
 * Jedno ime ili prezime u kanonskom obliku:
 * "  Петровић " → "petrovic", "Đorđe" → "djordje", "Marija   Ana" → "marija ana"
 */
export function normalizeName(rawName: string): string {
  return (
    rawName
      // Slovo sa kvačicom može biti jedan znak (č) ili dva (c + kvačica). NFC ih svodi na jedan.
      .normalize('NFC')
      .toLowerCase()
      .replace(/[\u0400-\u04FF]/g, (letter) => CYRILLIC_TO_LATIN[letter] ?? letter)
      .replace(/[čćšžđ]/g, (letter) => REMOVE_DIACRITICS[letter])
      // Više razmaka (ili tab, ili nerazdvojivi razmak) zaredom postaje jedan razmak
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Datum rođenja mora biti oblika GGGG-MM-DD (to daje <input type="date">)
 * i mora da postoji u kalendaru (1999-02-30 ne postoji).
 */
export function normalizeDateOfBirth(rawDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate.trim());

  if (match === null) {
    throw new Error('Datum rođenja mora biti u obliku GGGG-MM-DD');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Ako datum ne postoji, JavaScript ga "prelije" u sledeći mesec; tada se brojevi ne poklapaju
  const date = new Date(Date.UTC(year, month - 1, day));
  const exists =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  if (!exists) {
    throw new Error('Datum rođenja ne postoji u kalendaru');
  }

  return match[0];
}

// Tekst koji se heširuje: "prezime|ime". PREZIME JE PRVO.
export function buildNameKey(lastName: string, firstName: string): string {
  const last = normalizeName(lastName);
  const first = normalizeName(firstName);

  // Prazno ime bi dalo heš teksta "|", isti za sve koji ništa nisu upisali
  if (last === '' || first === '') {
    throw new Error('Ime i prezime su obavezni');
  }

  return last + '|' + first;
}

// Tekst koji se heširuje: "prezime|ime|GGGG-MM-DD"
export function buildNameDobKey(lastName: string, firstName: string, dateOfBirth: string): string {
  return buildNameKey(lastName, firstName) + '|' + normalizeDateOfBirth(dateOfBirth);
}

// SHA-256 nad UTF-8 tekstom, kao 64 mala heksadecimalna znaka
export async function sha256Hex(text: string): Promise<string> {
  // Web Crypto radi samo na HTTPS stranicama (i na localhost)
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Heširanje nije dostupno: stranica mora da se otvara preko HTTPS-a');
  }

  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export interface DocumentNameHashes {
  nameHash: string;
  // Nema ga kad datum rođenja nije zadat (platna kartica nema datum rođenja)
  nameDobHash?: string;
}

/**
 * Pravi heševe za predmet vrste DOCUMENT.
 * Backend traži da se OBA heša prave iz istog imena, zato ih pravi jedna funkcija.
 */
export async function hashDocumentName(
  lastName: string,
  firstName: string,
  dateOfBirth?: string | null,
): Promise<DocumentNameHashes> {
  const nameHash = await sha256Hex(buildNameKey(lastName, firstName));

  if (dateOfBirth === undefined || dateOfBirth === null || dateOfBirth.trim() === '') {
    return { nameHash };
  }

  const nameDobHash = await sha256Hex(buildNameDobKey(lastName, firstName, dateOfBirth));
  return { nameHash, nameDobHash };
}
