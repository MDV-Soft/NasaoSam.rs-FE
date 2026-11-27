import { formatDistance } from './distance';

describe('formatDistance', () => {
  it('writes meters below a kilometer', () => {
    expect(formatDistance(100)).toBe('100 m');
    expect(formatDistance(300)).toBe('300 m');
    expect(formatDistance(999)).toBe('999 m');
  });

  it('writes whole kilometers without decimals', () => {
    expect(formatDistance(1000)).toBe('1 km');
    expect(formatDistance(3000)).toBe('3 km');
    expect(formatDistance(5000)).toBe('5 km');
  });

  it('writes a decimal comma for the rest', () => {
    expect(formatDistance(1500)).toBe('1,5 km');
    expect(formatDistance(2500)).toBe('2,5 km');
  });
});
