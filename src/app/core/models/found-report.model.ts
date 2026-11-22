import { DocumentType, ItemCategory, ItemColor, LostReportItemRequest } from './lost-report.model';

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

// ---------- Nalazačeva strana (posle otvaranja linka iz mejla) ----------

// Životni ciklus nalaza. Samo ACTIVE nalazi učestvuju u spajanju.
export type FoundReportStatus =
  'PENDING_EMAIL' | 'PENDING_REVIEW' | 'ACTIVE' | 'RETURNED' | 'EXPIRED' | 'WITHDRAWN';

// Odgovor na POST /finder/access: privremeni token nalazača (uloga FINDER, vezan za jedan nalaz)
export interface FinderAccess {
  accessToken: string;
  // Do kada token važi (ISO, UTC); backend ga daje na 120 minuta
  expiresAt: string;
}

// Predmet onako kako ga nalazač vidi. Backend ne vraća heševe imena ni da li postoje,
// pa se ime sa dokumenta pri svakoj izmeni mora ponovo upisati.
export interface FinderReportItem {
  category: ItemCategory;
  customCategory: string | null;
  documentType: DocumentType | null;
  color: ItemColor | null;
  brand: string | null;
  material: string | null;
  description: string | null;
  distinctiveMarks: string | null;
}

// Odgovor na GET /finder/report i na sve izmene
export interface FinderReport {
  status: FoundReportStatus;
  foundAt: string;
  city: string;
  placeDescription: string | null;
  latitude: number;
  longitude: number;
  itemLocation: ItemLocation;
  handoverInfo: string | null;
  controlQuestion: string;
  hasPhoto: boolean;
  activatedAt: string | null;
  expiresAt: string;
  items: FinderReportItem[];
}

// PUT /finder/report/item-location
export interface UpdateItemLocationRequest {
  itemLocation: ItemLocation;
  // Obavezno kad predmet nije kod nalazača, a kad jeste, ne šalje se
  handoverInfo?: string;
}
