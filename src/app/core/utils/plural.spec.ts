import { matchesCount, pluralForm, pluralize } from './plural';

describe('plural (srpski)', () => {
  it('knows the three forms', () => {
    const forms = (numbers: number[]) => numbers.map(pluralForm);

    expect(forms([1, 21, 31, 101])).toEqual(['one', 'one', 'one', 'one']);
    expect(forms([2, 3, 4, 22, 23, 24, 102])).toEqual(Array(7).fill('few'));
    expect(forms([0, 5, 6, 10, 20, 25, 100])).toEqual(Array(7).fill('many'));
  });

  it('treats 11 to 14 as "many" (11 poklapanja, not 11 poklapanje)', () => {
    [11, 12, 13, 14, 111, 112, 113, 114].forEach((n) => expect(pluralForm(n)).toBe('many'));
  });

  it('picks the right word', () => {
    expect(pluralize(1, 'a', 'b', 'c')).toBe('a');
    expect(pluralize(3, 'a', 'b', 'c')).toBe('b');
    expect(pluralize(8, 'a', 'b', 'c')).toBe('c');
  });

  it('writes the number of matches', () => {
    expect(matchesCount(0)).toBe('0 poklapanja');
    expect(matchesCount(1)).toBe('1 poklapanje');
    expect(matchesCount(2)).toBe('2 poklapanja');
    expect(matchesCount(5)).toBe('5 poklapanja');
    expect(matchesCount(12)).toBe('12 poklapanja');
    expect(matchesCount(21)).toBe('21 poklapanje');
  });
});
