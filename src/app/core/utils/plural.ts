// Srpski množinski oblici: 1 poklapanje, 2-4 poklapanja, 5+ poklapanja, 11-14 poklapanja, 21 poklapanje

export type PluralForm = 'one' | 'few' | 'many';

export function pluralForm(count: number): PluralForm {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return 'one';
  }
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return 'few';
  }
  return 'many';
}

export function pluralize(count: number, one: string, few: string, many: string): string {
  const form = pluralForm(count);
  return form === 'one' ? one : form === 'few' ? few : many;
}

// "1 poklapanje", "3 poklapanja", "7 poklapanja"
export function matchesCount(count: number): string {
  return count + ' ' + pluralize(count, 'poklapanje', 'poklapanja', 'poklapanja');
}
