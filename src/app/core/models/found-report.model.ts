import { LostReportItemRequest } from './lost-report.model';

// Gde se predmet nalazi. Vrednosti moraju biti identične imenima konstanti u ItemLocation enumu na backendu.
export type ItemLocation = 'WITH_FINDER' | 'AT_INSTITUTION' | 'AT_POLICE';

// Predmet nalaza ima ista polja kao predmet oglasa (uključujući heševe imena sa dokumenta),
// samo bez id-ja: nalaz se uvek šalje ceo
export type FoundReportItemRequest = Omit<LostReportItemRequest, 'id'>;

// JSON deo zahteva POST /found-reports (slika ide kao drugi deo, "photo").
// Nalazač nema nalog, pa nema ni id korisnika.
export interface CreateFoundReportRequest {
  finderEmail: string;
  // Nije obavezan; ako se ne unese, polje se uopšte ne šalje
  finderPhone?: string;
  // ISO datum u UTC, npr. "2026-11-15T10:30:00.000Z"
  foundAt: string;
  city: string;
  placeDescription?: string;
  latitude: number;
  longitude: number;
  itemLocation: ItemLocation;
  // Obavezno kad predmet NIJE kod nalazača, a kad jeste, polje se ne šalje (backend odbija)
  handoverInfo?: string;
  controlQuestion: string;
  controlAnswer: string;
  items?: FoundReportItemRequest[];
}

// Odgovor na prijavu: namerno nema ni id nalaza, ni token, ni kontakt (ruta je javna)
export interface FoundReportSubmitted {
  message: string;
  // Do kada važi link iz mejla (ISO, UTC)
  linkExpiresAt: string;
}
