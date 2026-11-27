import { ItemOptions, OptionItem } from '../models/item-options.model';
import { LostReport, LostReportItem, LostReportStatus } from '../models/lost-report.model';
import { formatDistance } from './distance';

// Nazivi statusa oglasa za prikaz korisniku
const STATUS_LABELS: Record<LostReportStatus, string> = {
  ACTIVE: 'Aktivan',
  RETURNED: 'Vraćen',
  CLOSED: 'Zatvoren',
  EXPIRED: 'Istekao',
};

export function statusLabel(status: LostReportStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * Traži prikazni naziv ("Novčanik") za tehničku vrednost ("WALLET") u listi sa servera.
 * Ako liste još nema ili vrednost nije u njoj, vraća samu vrednost, da ekran nikad ne ostane prazan.
 */
export function findLabel(options: OptionItem[] | undefined, value: string | null): string {
  if (value === null) {
    return '';
  }

  return options?.find((option) => option.value === value)?.label ?? value;
}

/**
 * Naslov predmeta na kartici oglasa:
 *  - "Ostalo" → ono što je vlasnik upisao ("Kišobran")
 *  - dokument → "Dokument: Lična karta"
 *  - ostalo   → vrsta ("Novčanik")
 */
export function itemTitle(
  item: Pick<LostReportItem, 'category' | 'customCategory' | 'documentType'>,
  options: ItemOptions | null,
): string {
  const categoryLabel = findLabel(options?.categories, item.category);

  if (item.category === 'OTHER' && item.customCategory) {
    return item.customCategory;
  }
  if (item.category === 'DOCUMENT' && item.documentType) {
    return categoryLabel + ': ' + findLabel(options?.documentTypes, item.documentType);
  }
  return categoryLabel;
}

// Koliko daleko backend traži nalaze kad oglas ima tačku, a nema radijus
// (isto kao DEFAULT_RADIUS_METERS u MatchScorer na backendu)
export const DEFAULT_SEARCH_RADIUS_METERS = 5000;

/**
 * Gde se traže nalaze za oglas, za rečenicu "Tražimo nalaze ...". Isto kao što računa backend:
 *  - oglas ima tačku na mapi: nalaz mora biti u krugu oko nje (zadati radijus, inače 5 km)
 *  - oglas nema tačku: poredi se samo grad
 */
export function searchAreaText(
  report: Pick<LostReport, 'city' | 'latitude' | 'longitude' | 'locationRadiusMeters'>,
): string {
  if (report.latitude !== null && report.longitude !== null) {
    const radius = report.locationRadiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS;
    return 'u krugu od ' + formatDistance(radius) + ' oko tačke koju si označio';
  }
  return 'bilo gde u mestu ' + report.city + ' (oglas nema tačku na mapi)';
}
