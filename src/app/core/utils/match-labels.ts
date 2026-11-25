import { LostMatch, MatchConfidence } from '../models/lost-match.model';

// Nazivi nivoa verovatnoće za prikaz vlasniku
const CONFIDENCE_LABELS: Record<MatchConfidence, string> = {
  HIGH: 'Veoma verovatno',
  MEDIUM: 'Verovatno',
  LOW: 'Moguće',
};

// Koliko od tri crtice na pokazivaču je popunjeno
const CONFIDENCE_LEVELS: Record<MatchConfidence, 1 | 2 | 3> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function confidenceLabel(confidence: MatchConfidence): string {
  return CONFIDENCE_LABELS[confidence] ?? confidence;
}

export function confidenceLevel(confidence: MatchConfidence): 1 | 2 | 3 {
  return CONFIDENCE_LEVELS[confidence] ?? 1;
}

// Najverovatnije poklapanje iz liste (server ih šalje sortirane, ali se ne oslanjamo na to)
export function bestConfidence(matches: LostMatch[]): MatchConfidence | null {
  let best: MatchConfidence | null = null;

  matches.forEach((match) => {
    if (best === null || confidenceLevel(match.confidence) > confidenceLevel(best)) {
      best = match.confidence;
    }
  });
  return best;
}
