import { DocumentType, ItemCategory, ItemColor } from './lost-report.model';

// Koliko je poklapanje verovatno. Tačna ocena se namerno ne šalje, samo ovaj nivo.
export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Poklapanje izgubljenog predmeta sa pronađenim (GET /lost-reports/{id}/matches),
 * onako kako ga vidi vlasnik: bez kontakta nalazača, tačne lokacije, marke, opisa i kontrolnog
 * pitanja. To vlasnik dobija tek posle provere vlasništva.
 */
export interface LostMatch {
  matchId: number;
  // Koji predmet iz vlasnikovog oglasa se poklopio (oglas može imati više predmeta)
  lostItemId: number;
  confidence: MatchConfidence;
  // Predmet koji je nalazač pronašao
  category: ItemCategory;
  customCategory: string | null;
  documentType: DocumentType | null;
  color: ItemColor | null;
  city: string;
  // Samo dan nalaza ("GGGG-MM-DD"), bez sata
  foundDate: string;
  // Putanja do zamućene slike bez adrese servera, ili null ako slike nema
  photoUrl: string | null;
}
