import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ItemOptions } from '../../../core/models/item-options.model';
import {
  CreateLostReportRequest,
  DocumentType,
  ItemCategory,
  ItemColor,
} from '../../../core/models/lost-report.model';
import { LostReportService } from '../../../core/services/lost-report.service';
import { MetaService } from '../../../core/services/meta.service';
import { ItemFormValue, buildItemRequest } from '../../../core/utils/lost-item-request';
import {
  CompletenessInput,
  CompletenessItem,
  DESCRIPTION_TIERS,
  Suggestion,
  completenessScore,
  itemScore,
  suggestions,
} from '../../../core/utils/completeness-score';
import { LocationPicker, MapLocation } from '../location-picker/location-picker';
import { PrecisionMeter } from '../precision-meter/precision-meter';
import {
  MIN_DESCRIPTION_LENGTH,
  lostItemValidator,
} from '../../../core/validators/lost-item-validators';
import {
  coordinatesValidator,
  lostTimeValidator,
} from '../../../core/validators/lost-report-validators';

// Deo oglasa koji se popunjava na prvom koraku (predmeti stižu na drugom)
export type LostReportDraft = Omit<CreateLostReportRequest, 'items'>;

// Najviše predmeta u jednom oglasu (isto kao @Size(max = 10) na backendu)
const MAX_ITEMS = 10;

// Najduži detaljan opis (isto kao @Size(max = 1000) za privateDetails na backendu)
const MAX_DETAILS_LENGTH = 1000;

@Component({
  selector: 'app-lost-report-form',
  imports: [ReactiveFormsModule, RouterLink, LocationPicker, PrecisionMeter],
  templateUrl: './lost-report-form.html',
  styleUrl: './lost-report-form.css',
})
export class LostReportForm {
  private metaService = inject(MetaService);
  private lostReportService = inject(LostReportService);
  private router = inject(Router);

  readonly maxItems = MAX_ITEMS;
  readonly minDescriptionLength = MIN_DESCRIPTION_LENGTH;
  readonly descriptionTiers = DESCRIPTION_TIERS;

  // Forma ima dva koraka: "report" (podaci o oglasu) i "items" (predmeti)
  step = signal<'report' | 'items'>('report');

  // Podaci iz prvog koraka, spremni za slanje. Postoji tek posle uspešnog "Dalje".
  draft = signal<LostReportDraft | null>(null);

  // Liste za padajuće menije (vrste predmeta, dokumenata, boje), sa servera
  options = signal<ItemOptions | null>(null);
  optionsFailed = signal<boolean>(false);

  isSaving = signal<boolean>(false);
  submitErrors = signal<string[]>([]);

  // Najkasniji dozvoljen datum rođenja je danas (lokalni datum, oblik GGGG-MM-DD)
  readonly today: string = this.formatLocalDate(new Date());

  // ---------- Korak 1: oglas ----------

  // Ograničenja (100, 255, 1000, opseg koordinata, 50000) su ista kao u CreateLostReportRequest
  reportForm = new FormGroup(
    {
      lostFrom: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      lostTo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      city: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(100)],
      }),
      placeDescription: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(255)],
      }),
      latitude: new FormControl<number | null>(null, [Validators.min(-90), Validators.max(90)]),
      longitude: new FormControl<number | null>(null, [Validators.min(-180), Validators.max(180)]),
      locationRadiusMeters: new FormControl<number | null>(null, [
        Validators.min(0),
        Validators.max(50000),
        Validators.pattern(/^\d+$/), // ceo broj: backend očekuje Integer
      ]),
    },
    { validators: [lostTimeValidator(), coordinatesValidator()] },
  );

  // ---------- Korak 2: predmeti ----------

  // Lista predmeta: svaki predmet je grupa polja. Počinje sa jednim praznim predmetom.
  // details je detaljan opis svega izgubljenog: na backendu je to polje privateDetails
  // (čuva se šifrovano, nalazači ga ne vide, a koristi se pri spajanju i proveri vlasnika).
  itemsForm = new FormGroup({
    items: new FormArray([this.createItemGroup()]),
    details: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_DETAILS_LENGTH)],
    }),
  });

  readonly maxDetailsLength = MAX_DETAILS_LENGTH;

  // ---------- Preciznost oglasa (uživo) ----------

  // Forme nisu signali: svaka promena u njima povećava ovaj brojač, pa se preračuna sve ispod
  private formRevision = signal<number>(0);

  private completenessInput = computed<CompletenessInput>(() => {
    this.formRevision();
    return this.buildCompletenessInput();
  });

  score = computed<number>(() => completenessScore(this.completenessInput()));
  suggestions = computed<Suggestion[]>(() => suggestions(this.completenessInput()));
  itemScores = computed<number[]>(() => this.completenessInput().items.map(itemScore));

  // Trenutni pin za mapu (iz polja latitude, longitude i radijusa)
  mapLocation = computed<MapLocation | null>(() => {
    this.formRevision();
    const value = this.reportForm.getRawValue();
    if (value.latitude === null || value.longitude === null) {
      return null;
    }
    return {
      latitude: value.latitude,
      longitude: value.longitude,
      radiusMeters: value.locationRadiusMeters ?? 0,
    };
  });

  constructor() {
    this.loadOptions();

    const bump = () => this.formRevision.update((n) => n + 1);
    this.reportForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(bump);
    this.itemsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(bump);
  }

  /**
   * Koliko bi ukupna preciznost porasla kad bi se polje popunilo ("+7"), ili kvačica
   * kad je polje već popunjeno do kraja. key je isti kao u completeness-score.ts.
   */
  pointsBadge(key: string): string {
    const suggestion = this.suggestions().find((s) => s.key === key);
    return suggestion ? '+' + suggestion.gain : '✓';
  }

  isScored(key: string): boolean {
    return !this.suggestions().some((s) => s.key === key);
  }

  onLocationChange(location: MapLocation | null): void {
    this.reportForm.patchValue({
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      locationRadiusMeters: location?.radiusMeters ?? null,
    });
    this.reportForm.controls.latitude.markAsTouched();
  }

  detailsLength(): number {
    return this.itemsForm.controls.details.value.trim().length;
  }

  get itemGroups() {
    return this.itemsForm.controls.items.controls;
  }

  loadOptions(): void {
    this.optionsFailed.set(false);

    this.metaService.getOptions().subscribe({
      next: (options) => this.options.set(options),
      error: () => this.optionsFailed.set(true),
    });
  }

  addItem(): void {
    const items = this.itemsForm.controls.items;

    if (items.length < MAX_ITEMS) {
      items.push(this.createItemGroup());
    }
  }

  // Poslednji predmet se ne može ukloniti: oglas mora imati bar jedan
  removeItem(index: number): void {
    const items = this.itemsForm.controls.items;

    if (items.length > 1) {
      items.removeAt(index);
    }
  }

  // Broj znakova opisa bez razmaka sa krajeva (tako ga računa i backend)
  descriptionLength(index: number): number {
    return this.itemGroups[index].controls.description.value.trim().length;
  }

  // ---------- Prelazak između koraka ----------

  onNext(): void {
    const controls = this.reportForm.controls;
    controls.city.setValue(controls.city.value.trim());

    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      return;
    }

    this.draft.set(this.buildDraft());
    this.step.set('items');
  }

  onBack(): void {
    this.step.set('report');
  }

  // ---------- Slanje ----------

  /**
   * Proverava predmete, pravi heševe imena sa dokumenata (to je asinhrono),
   * pa šalje ceo oglas. Vraća se čim je zahtev poslat; odgovor stiže u subscribe.
   */
  async onSubmit(): Promise<void> {
    const draft = this.draft();

    // Dvoklik ne sme da pošalje dva oglasa
    if (this.isSaving()) {
      return;
    }

    if (draft === null || this.itemsForm.invalid) {
      this.itemsForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.submitErrors.set([]);

    let items;
    try {
      items = await Promise.all(
        this.itemGroups.map((group) => buildItemRequest(group.getRawValue())),
      );
    } catch (error) {
      this.isSaving.set(false);
      this.submitErrors.set([
        error instanceof Error ? error.message : 'Priprema predmeta nije uspela.',
      ]);
      return;
    }

    const request: CreateLostReportRequest = { ...draft, items };
    const details = this.itemsForm.controls.details.value.trim();
    if (details !== '') {
      request.privateDetails = details;
    }

    this.lostReportService.create(request).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.router.navigate(['/moji-oglasi']);
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving.set(false);
        this.submitErrors.set(this.describeError(error));
      },
    });
  }

  // ---------- Pomoćne metode ----------

  // Jedan predmet: grupa polja + validator koji zna pravila po vrsti predmeta
  private createItemGroup() {
    return new FormGroup(
      {
        category: new FormControl<ItemCategory | ''>('', {
          nonNullable: true,
          validators: [Validators.required],
        }),
        customCategory: new FormControl('', {
          nonNullable: true,
          validators: [Validators.maxLength(50)],
        }),
        documentType: new FormControl<DocumentType | ''>('', { nonNullable: true }),
        color: new FormControl<ItemColor | ''>('', { nonNullable: true }),
        brand: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
        material: new FormControl('', {
          nonNullable: true,
          validators: [Validators.maxLength(50)],
        }),
        description: new FormControl('', {
          nonNullable: true,
          validators: [Validators.maxLength(2000)],
        }),
        distinctiveMarks: new FormControl('', {
          nonNullable: true,
          validators: [Validators.maxLength(500)],
        }),
        // Samo za dokumenta; serveru idu isključivo kao heš
        lastName: new FormControl('', {
          nonNullable: true,
          validators: [Validators.maxLength(100)],
        }),
        firstName: new FormControl('', {
          nonNullable: true,
          validators: [Validators.maxLength(100)],
        }),
        dateOfBirth: new FormControl('', { nonNullable: true }),
      },
      { validators: lostItemValidator() },
    );
  }

  /**
   * Pretvara vrednosti prvog koraka u oblik koji backend očekuje:
   *  - datum i vreme iz <input type="datetime-local"> (lokalno vreme) → ISO tekst u UTC
   *  - prazna neobavezna polja se izostavljaju, ne šalju se kao ""
   */
  private buildDraft(): LostReportDraft {
    const value = this.reportForm.getRawValue();

    const draft: LostReportDraft = {
      lostFrom: new Date(value.lostFrom).toISOString(),
      lostTo: new Date(value.lostTo).toISOString(),
      city: value.city.trim(),
    };

    const placeDescription = value.placeDescription.trim();
    if (placeDescription !== '') {
      draft.placeDescription = placeDescription;
    }
    if (value.latitude !== null && value.longitude !== null) {
      draft.latitude = value.latitude;
      draft.longitude = value.longitude;
    }
    if (value.locationRadiusMeters !== null) {
      draft.locationRadiusMeters = value.locationRadiusMeters;
    }
    return draft;
  }

  // Šta je popunjeno, u obliku koji traži kalkulator (isto što bi backend video po slanju)
  private buildCompletenessInput(): CompletenessInput {
    const report = this.reportForm.getRawValue();

    return {
      hasPlaceDescription: report.placeDescription.trim() !== '',
      hasCoordinates: report.latitude !== null && report.longitude !== null,
      hasDetails: this.itemsForm.controls.details.value.trim() !== '',
      items: this.itemGroups.map((group) => this.toCompletenessItem(group.getRawValue())),
    };
  }

  // Ista pravila kao buildItemRequest: računa se samo ono što bi zaista otišlo na server
  private toCompletenessItem(value: ItemFormValue): CompletenessItem {
    const filled = (text: string) => text.trim() !== '';

    if (value.category === 'DOCUMENT') {
      const hasName = filled(value.lastName) && filled(value.firstName);
      return {
        category: value.category,
        hasDocumentType: value.documentType !== '',
        hasNameHash: hasName,
        hasNameDobHash: hasName && value.documentType !== 'BANK_CARD' && filled(value.dateOfBirth),
        hasColor: false,
        hasBrand: false,
        hasMaterial: false,
        hasDistinctiveMarks: false,
        descriptionLength: 0,
      };
    }

    return {
      category: value.category,
      hasDocumentType: false,
      hasNameHash: false,
      hasNameDobHash: false,
      hasColor: value.color !== '',
      hasBrand: filled(value.brand),
      hasMaterial: filled(value.material),
      hasDistinctiveMarks: filled(value.distinctiveMarks),
      descriptionLength: value.description.trim().length,
    };
  }

  /**
   * Poruke o grešci sa servera. Backend šalje telo { status, message, fieldErrors }.
   * Greške po poljima imaju ključeve kao "items[0].brand": ispred poruke stavljamo "Predmet 1".
   */
  private describeError(error: HttpErrorResponse): string[] {
    if (error.status === 0) {
      return ['Server nije dostupan. Proveri da li backend radi.'];
    }

    const body = error.error;
    const fieldErrors: Record<string, string> = body?.fieldErrors ?? {};
    const messages: string[] = Object.keys(fieldErrors).map((key) => {
      const itemMatch = /^items\[(\d+)\]/.exec(key);
      return itemMatch
        ? 'Predmet ' + (Number(itemMatch[1]) + 1) + ': ' + fieldErrors[key]
        : fieldErrors[key];
    });

    if (messages.length === 0) {
      messages.push(body?.message ?? 'Čuvanje oglasa nije uspelo. Pokušaj ponovo.');
    }
    return messages;
  }

  private formatLocalDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}
