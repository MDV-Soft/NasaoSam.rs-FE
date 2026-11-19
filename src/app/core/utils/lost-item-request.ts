import {
  DocumentType,
  ItemCategory,
  ItemColor,
  LostReportItemRequest,
} from '../models/lost-report.model';
import { hashDocumentName } from './name-hash';

// Sve što korisnik unosi za jedan predmet u formi. Polja su uvek tekst ('' = ništa nije izabrano).
// lastName, firstName i dateOfBirth postoje samo u formi: serveru idu samo kao heševi.
export interface ItemFormValue {
  category: ItemCategory | '';
  customCategory: string;
  documentType: DocumentType | '';
  color: ItemColor | '';
  brand: string;
  material: string;
  description: string;
  distinctiveMarks: string;
  lastName: string;
  firstName: string;
  dateOfBirth: string;
}

/**
 * Pretvara jedan predmet iz forme u zahtev koji backend očekuje.
 * Šalju se SAMO polja koja važe za izabranu vrstu (backend odbija ostala):
 *  - customCategory samo za "Ostalo"
 *  - documentType i heševi samo za "Dokument"
 *  - boja, marka, materijal, opis i posebni znaci samo za predmete koji nisu dokumenta
 * Prazna polja se izostavljaju.
 */
export async function buildItemRequest(value: ItemFormValue): Promise<LostReportItemRequest> {
  if (value.category === '') {
    throw new Error('Vrsta predmeta je obavezna');
  }

  const item: LostReportItemRequest = { category: value.category };

  if (value.category === 'DOCUMENT') {
    if (value.documentType !== '') {
      item.documentType = value.documentType;
    }

    const lastName = value.lastName.trim();
    const firstName = value.firstName.trim();
    if (lastName !== '' && firstName !== '') {
      // Platna kartica nema datum rođenja (backend odbija heš datuma uz nju)
      const dateOfBirth = value.documentType === 'BANK_CARD' ? null : value.dateOfBirth;
      const hashes = await hashDocumentName(lastName, firstName, dateOfBirth);

      item.nameHash = hashes.nameHash;
      if (hashes.nameDobHash !== undefined) {
        item.nameDobHash = hashes.nameDobHash;
      }
    }

    return item;
  }

  if (value.category === 'OTHER') {
    item.customCategory = value.customCategory.trim();
  }
  if (value.color !== '') {
    item.color = value.color;
  }

  const optionalTexts = {
    brand: value.brand,
    material: value.material,
    description: value.description,
    distinctiveMarks: value.distinctiveMarks,
  };
  (Object.keys(optionalTexts) as (keyof typeof optionalTexts)[]).forEach((field) => {
    const text = optionalTexts[field].trim();
    if (text !== '') {
      item[field] = text;
    }
  });

  return item;
}
