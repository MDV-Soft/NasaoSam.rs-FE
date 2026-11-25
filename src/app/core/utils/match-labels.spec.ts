import { LostMatch } from '../models/lost-match.model';
import { bestConfidence, confidenceLabel, confidenceLevel } from './match-labels';

const match = (confidence: LostMatch['confidence']): LostMatch => ({
  matchId: 1,
  lostItemId: 1,
  confidence,
  category: 'WALLET',
  customCategory: null,
  documentType: null,
  color: null,
  city: 'Niš',
  foundDate: '2026-11-25',
  photoUrl: null,
});

describe('match labels', () => {
  it('names the three levels', () => {
    expect(confidenceLabel('HIGH')).toBe('Veoma verovatno');
    expect(confidenceLabel('MEDIUM')).toBe('Verovatno');
    expect(confidenceLabel('LOW')).toBe('Moguće');
  });

  it('gives the number of filled marks (3, 2, 1)', () => {
    expect(confidenceLevel('HIGH')).toBe(3);
    expect(confidenceLevel('MEDIUM')).toBe(2);
    expect(confidenceLevel('LOW')).toBe(1);
  });

  it('finds the best level in a list, whatever the order', () => {
    expect(bestConfidence([match('LOW'), match('HIGH'), match('MEDIUM')])).toBe('HIGH');
    expect(bestConfidence([match('LOW'), match('MEDIUM')])).toBe('MEDIUM');
    expect(bestConfidence([match('LOW')])).toBe('LOW');
  });

  it('has no best level for an empty list', () => {
    expect(bestConfidence([])).toBeNull();
  });
});
