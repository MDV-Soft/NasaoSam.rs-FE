// Vrednosti moraju biti identične imenima konstanti u Java enumima na backendu
export type ItemCategory = 'WALLET' | 'DOCUMENT' | 'KEYS' | 'PHONE' | 'BAG' | 'OTHER';

export type DocumentType =
  | 'ID_CARD'
  | 'DRIVER_LICENSE'
  | 'VEHICLE_REGISTRATION'
  | 'PASSPORT'
  | 'BANK_CARD'
  | 'HEALTH_CARD'
  | 'OTHER';

export type ItemColor =
  | 'BLACK'
  | 'WHITE'
  | 'GRAY'
  | 'BROWN'
  | 'BEIGE'
  | 'RED'
  | 'PINK'
  | 'ORANGE'
  | 'YELLOW'
  | 'GREEN'
  | 'BLUE'
  | 'PURPLE'
  | 'SILVER'
  | 'GOLD'
  | 'MULTICOLOR';

export type LostReportStatus = 'ACTIVE' | 'RETURNED' | 'CLOSED' | 'EXPIRED';

// ---------- Ono što ŠALJEMO serveru (POST i PUT) ----------

export interface LostReportItemRequest {
  category: ItemCategory;
  customCategory?: string;
  documentType?: DocumentType;
  color?: ItemColor;
  brand?: string;
  material?: string;
  description?: string;
  distinctiveMarks?: string;
  nameHash?: string;
  nameDobHash?: string;
  // Šalje se samo pri izmeni oglasa, za predmet koji već postoji
  id?: number;
}

export interface CreateLostReportRequest {
  // ISO datum u UTC, npr. "2026-11-15T10:30:00.000Z"
  lostFrom: string;
  lostTo: string;
  city: string;
  placeDescription?: string;
  latitude?: number;
  longitude?: number;
  locationRadiusMeters?: number;
  privateDetails?: string;
  items: LostReportItemRequest[];
}

// ---------- Ono što DOBIJAMO od servera ----------

export interface LostReportItem {
  id: number;
  category: ItemCategory;
  customCategory: string | null;
  documentType: DocumentType | null;
  color: ItemColor | null;
  brand: string | null;
  material: string | null;
  description: string | null;
  distinctiveMarks: string | null;
  // Server nikad ne vraća same heševe, samo da li postoje
  hasNameHash: boolean;
  hasNameDobHash: boolean;
}

export interface LostReport {
  id: number;
  status: LostReportStatus;
  lostFrom: string;
  lostTo: string;
  city: string;
  placeDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  locationRadiusMeters: number | null;
  privateDetails: string | null;
  completenessScore: number;
  expiresAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: LostReportItem[];
}
