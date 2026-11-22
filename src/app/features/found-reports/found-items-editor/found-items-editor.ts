import { Component, OnInit, input } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FinderReportItem, FoundReportItemRequest } from '../../../core/models/found-report.model';
import { ItemOptions } from '../../../core/models/item-options.model';
import { DocumentType, ItemCategory, ItemColor } from '../../../core/models/lost-report.model';
import { buildItemRequest } from '../../../core/utils/lost-item-request';
import { formatLocalDate } from '../../../core/utils/moment';
import { foundItemValidator } from '../../../core/validators/found-item-validators';

// Najviše predmeta u jednom nalazu (isto kao @Size(max = 10) na backendu)
const MAX_ITEMS = 10;

/**
 * Jedan predmet nalaza: grupa polja + validator koji zna pravila po vrsti predmeta.
 * Ako se zada predmet sa servera, polja se popunjavaju njime (ime sa dokumenta ostaje prazno:
 * server ga ne vraća u čitljivom obliku).
 */
export function createFoundItemGroup(item?: FinderReportItem) {
  return new FormGroup(
    {
      category: new FormControl<ItemCategory | ''>(item?.category ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      customCategory: new FormControl(item?.customCategory ?? '', {
        nonNullable: true,
        validators: [Validators.maxLength(50)],
      }),
      documentType: new FormControl<DocumentType | ''>(item?.documentType ?? '', {
        nonNullable: true,
      }),
      color: new FormControl<ItemColor | ''>(item?.color ?? '', { nonNullable: true }),
      brand: new FormControl(item?.brand ?? '', {
        nonNullable: true,
        validators: [Validators.maxLength(100)],
      }),
      material: new FormControl(item?.material ?? '', {
        nonNullable: true,
        validators: [Validators.maxLength(50)],
      }),
      description: new FormControl(item?.description ?? '', {
        nonNullable: true,
        validators: [Validators.maxLength(2000)],
      }),
      distinctiveMarks: new FormControl(item?.distinctiveMarks ?? '', {
        nonNullable: true,
        validators: [Validators.maxLength(500)],
      }),
      // Samo za dokumenta; serveru idu isključivo kao heš
      lastName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
      firstName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(100)],
      }),
      dateOfBirth: new FormControl('', { nonNullable: true }),
    },
    { validators: foundItemValidator() },
  );
}

export type FoundItemGroup = ReturnType<typeof createFoundItemGroup>;

/**
 * Uređivač predmeta nalaza: lista predmeta sa poljima koja zavise od vrste (Ostalo traži naziv,
 * Dokument traži vrstu i ime). Za razliku od oglasa izgubljenog predmeta, opis nije obavezan.
 *
 * Ime i datum rođenja sa dokumenta ne napuštaju browser: serveru ide samo heš.
 *
 * Komponenta ne šalje ništa na server: roditelj poziva validate() i buildRequests(), pa šalje.
 * Kad AI počne da prepoznaje predmete sa slike, njegov predlog ulazi ovde kroz initialItems,
 * a nalazač ga potvrđuje ili ispravlja.
 */
@Component({
  selector: 'app-found-items-editor',
  imports: [ReactiveFormsModule],
  templateUrl: './found-items-editor.html',
  styleUrls: ['../finder-controls.css', './found-items-editor.css'],
})
export class FoundItemsEditor implements OnInit {
  options = input.required<ItemOptions>();
  // Predmeti koji se odmah prikazuju (npr. već sačuvani na serveru)
  initialItems = input<FinderReportItem[]>([]);

  readonly maxItems = MAX_ITEMS;
  // Najkasniji dozvoljen datum rođenja na dokumentu je danas
  readonly today: string = formatLocalDate(new Date());

  form = new FormGroup({ items: new FormArray<FoundItemGroup>([]) });

  // Dokumenta koja stižu sa servera: njihovo ime treba ponovo upisati
  private restoredDocuments = new Set<FoundItemGroup>();

  get itemGroups(): FoundItemGroup[] {
    return this.form.controls.items.controls;
  }

  ngOnInit(): void {
    this.reset(this.initialItems());
  }

  // Zamenjuje listu zadatim predmetima (bar jedan prazan, da forma nikad nije prazna)
  reset(items: FinderReportItem[]): void {
    const array = this.form.controls.items;
    array.clear();
    this.restoredDocuments.clear();

    items.forEach((item) => {
      const group = createFoundItemGroup(item);
      if (item.category === 'DOCUMENT') {
        this.restoredDocuments.add(group);
      }
      array.push(group);
    });
    if (array.length === 0) {
      array.push(createFoundItemGroup());
    }
    this.form.markAsPristine();
  }

  addItem(): void {
    const items = this.form.controls.items;

    if (items.length < MAX_ITEMS) {
      items.push(createFoundItemGroup());
    }
  }

  // Poslednji predmet se ne može ukloniti: nalaz mora imati bar jedan
  removeItem(index: number): void {
    const items = this.form.controls.items;

    if (items.length > 1) {
      this.restoredDocuments.delete(items.at(index));
      items.removeAt(index);
    }
  }

  isRestoredDocument(group: FoundItemGroup): boolean {
    return this.restoredDocuments.has(group);
  }

  // Pokazuje greške na svim poljima; vraća da li je sve ispravno
  validate(): boolean {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return false;
    }
    return true;
  }

  // Predmeti u obliku koji backend očekuje (pravi heševe imena sa dokumenata, to je asinhrono)
  buildRequests(): Promise<FoundReportItemRequest[]> {
    return Promise.all(this.itemGroups.map((group) => buildItemRequest(group.getRawValue())));
  }
}
