import { Component, computed, input } from '@angular/core';
import { Suggestion, precisionLevel } from '../../../core/utils/completeness-score';

// Koliko predloga se prikazuje odjednom (najvredniji prvi)
const MAX_SUGGESTIONS = 4;

/**
 * Panel "Preciznost oglasa": ocena uživo, nivo i šta još najviše podiže ocenu.
 * Samo prikazuje; ocenu i predloge računa forma (core/utils/completeness-score.ts).
 */
@Component({
  selector: 'app-precision-meter',
  templateUrl: './precision-meter.html',
  styleUrl: './precision-meter.css',
})
export class PrecisionMeter {
  score = input.required<number>();
  suggestions = input<Suggestion[]>([]);

  level = computed(() => precisionLevel(this.score()));
  topSuggestions = computed(() => this.suggestions().slice(0, MAX_SUGGESTIONS));

  // Granice nivoa na traci (40 = solidno, 70 = vrlo precizno, 90 = odlično)
  readonly ticks = [40, 70, 90];

  suggestionText(suggestion: Suggestion): string {
    return suggestion.itemIndex === null
      ? suggestion.label
      : 'Predmet ' + (suggestion.itemIndex + 1) + ': ' + suggestion.label;
  }
}
