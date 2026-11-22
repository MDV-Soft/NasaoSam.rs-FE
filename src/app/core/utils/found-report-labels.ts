import { ItemLocation } from '../models/found-report.model';

export interface ItemLocationOption {
  value: ItemLocation;
  label: string;
  hint: string;
}

/**
 * Gde se predmet nalazi. Za razliku od vrsta predmeta i boja, ove nazive backend još ne šalje
 * (GET /meta/options ih nema), pa stoje ovde. Vrednosti moraju odgovarati ItemLocation enumu.
 */
export const ITEM_LOCATION_OPTIONS: ItemLocationOption[] = [
  { value: 'WITH_FINDER', label: 'Kod mene', hint: 'Čuvam ga ja i predaću ga vlasniku.' },
  {
    value: 'AT_INSTITUTION',
    label: 'U ustanovi ili lokalu',
    hint: 'Predao sam ga npr. u pošti, prodavnici ili školi.',
  },
  { value: 'AT_POLICE', label: 'U policiji', hint: 'Predao sam ga u policijsku stanicu.' },
];
