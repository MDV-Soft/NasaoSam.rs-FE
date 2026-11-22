import { ItemOptions, OptionItem } from '../models/item-options.model';
import { LostReportItem, LostReportStatus } from '../models/lost-report.model';

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
