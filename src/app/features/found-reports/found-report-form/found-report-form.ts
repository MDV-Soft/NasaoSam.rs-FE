import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CreateFoundReportRequest,
  FoundReportSubmitted,
  ItemLocation,
} from '../../../core/models/found-report.model';
import { FoundReportService } from '../../../core/services/found-report.service';
import { apiErrorMessages } from '../../../core/utils/api-error';
import { ITEM_LOCATION_OPTIONS } from '../../../core/utils/found-report-labels';
import { formatLocalDateTime, roundDownToStep } from '../../../core/utils/moment';
import {
  MAX_PHOTO_BYTES,
  formatFileSize,
  photoSizeProblem,
  photoTypeProblem,
  preparePhoto,
} from '../../../core/utils/photo-file';
import { serbianMobileValidator } from '../../../core/validators/form-validators';
import {
  MAX_FOUND_PAST_DAYS,
  foundTimeValidator,
  handoverValidator,
} from '../../../core/validators/found-report-validators';
import { LocationPicker, MapLocation } from '../../lost-reports/location-picker/location-picker';
import { MomentPicker } from '../../shared/moment-picker/moment-picker';
import { FinderShell } from '../finder-shell/finder-shell';

type StepId = 'photo' | 'place' | 'handover';

interface StepInfo {
  id: StepId;
  label: string;
}

const STEPS: StepInfo[] = [
  { id: 'photo', label: 'Fotografija' },
  { id: 'place', label: 'Mesto i vreme' },
  { id: 'handover', label: 'Predaja i kontakt' },
];

/**
 * Prijava pronađenog predmeta (javna stranica, bez naloga). Tri koraka:
 *  1. fotografija   2. mesto i vreme   3. predaja i kontakt
 *
 * Predmet se ovde NE opisuje: to nalazač radi posle linka iz mejla, na stranici za pregled, gde će
 * (kad AI postoji) stajati predlog sa slike koji nalazač samo potvrđuje ili ispravlja.
 *
 * Svaki korak se proverava pre prelaska na sledeći, a unazad se može slobodno. Ništa ne ide na
 * server dok se ne pošalje poslednji korak. Odgovor je samo "proveri mejl": nalaz postaje
 * aktivan tek kad nalazač otvori link iz mejla i potvrdi ga.
 */
@Component({
  selector: 'app-found-report-form',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, LocationPicker, MomentPicker, FinderShell],
  templateUrl: './found-report-form.html',
  styleUrls: ['../finder-controls.css', './found-report-form.css'],
})
export class FoundReportForm implements OnDestroy {
  private foundReportService = inject(FoundReportService);
  private injector = inject(Injector);

  readonly steps = STEPS;
  readonly itemLocations = ITEM_LOCATION_OPTIONS;
  // Backend ne prima nalaz stariji od 30 dana, pa se toliko dana unazad i nudi
  readonly maxDaysBack = MAX_FOUND_PAST_DAYS;
  readonly maxPhotoMegabytes = MAX_PHOTO_BYTES / (1024 * 1024);
  readonly formatFileSize = formatFileSize;

  // ---------- Koraci ----------

  stepIndex = signal<number>(0);
  currentStep = computed<StepInfo>(() => STEPS[this.stepIndex()]);

  // Naslov koraka dobija fokus pri svakom prelasku (čitač ekrana i tastatura znaju gde su)
  private heading = viewChild<ElementRef<HTMLElement>>('heading');

  // ---------- Korak 1: fotografija ----------

  photo = signal<File | null>(null);
  photoUrl = signal<string | null>(null);
  photoError = signal<string>('');
  photoBusy = signal<boolean>(false);

  // ---------- Korak 2: mesto i vreme ----------

  placeForm = new FormGroup({
    // Vreme nalaska bira MomentPicker; kreće od "sada" (zaokruženo naniže na 5 minuta)
    foundAt: new FormControl(formatLocalDateTime(roundDownToStep(new Date())), {
      nonNullable: true,
      validators: [Validators.required, foundTimeValidator()],
    }),
    city: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    placeDescription: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(255)],
    }),
    // Tačka na mapi je obavezna: bez nje vlasnik ne zna gde da traži
    latitude: new FormControl<number | null>(null, [Validators.required]),
    longitude: new FormControl<number | null>(null, [Validators.required]),
  });

  mapLocation = signal<MapLocation | null>(null);

  // ---------- Korak 3: predaja i kontakt ----------

  // Ograničenja (255, 500, 30) su ista kao u CreateFoundReportRequest na backendu
  handoverForm = new FormGroup(
    {
      itemLocation: new FormControl<ItemLocation | ''>('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      handoverInfo: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(255)],
      }),
      controlQuestion: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(255)],
      }),
      controlAnswer: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(500)],
      }),
      finderEmail: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email, Validators.maxLength(255)],
      }),
      finderPhone: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(30), serbianMobileValidator()],
      }),
    },
    { validators: handoverValidator() },
  );

  // ---------- Slanje ----------

  isSaving = signal<boolean>(false);
  submitErrors = signal<string[]>([]);
  submitted = signal<FoundReportSubmitted | null>(null);
  // Mejl na koji je poslat link (za ekran posle slanja)
  sentTo = signal<string>('');

  ngOnDestroy(): void {
    this.revokePhotoUrl();
  }

  // ---------- Prelazak između koraka ----------

  next(): void {
    if (!this.validateStep(this.currentStep().id)) {
      return;
    }
    this.goToIndex(this.stepIndex() + 1);
  }

  back(): void {
    if (this.stepIndex() > 0) {
      this.goToIndex(this.stepIndex() - 1);
    }
  }

  // Klik na već prođen korak u traci napretka. Unapred se ne skače: koraci se proveravaju redom.
  goTo(index: number): void {
    if (index >= 0 && index < this.stepIndex()) {
      this.goToIndex(index);
    }
  }

  private goToIndex(index: number): void {
    this.stepIndex.set(index);
    this.submitErrors.set([]);
    this.focusHeading();
  }

  private focusHeading(): void {
    afterNextRender(() => this.heading()?.nativeElement.focus(), { injector: this.injector });
  }

  /**
   * Razmaci sa krajeva (npr. pri kopiranju mejla) se uklanjaju pre provere. Bez toga bi "   "
   * prošlo kao popunjeno polje, a mejl sa razmakom na kraju bio odbijen kao neispravan.
   */
  private trimTextFields(): void {
    const trim = (control: FormControl<string>) => {
      const trimmed = control.value.trim();
      if (trimmed !== control.value) {
        control.setValue(trimmed);
      }
    };

    const place = this.placeForm.controls;
    trim(place.city);
    trim(place.placeDescription);

    const handover = this.handoverForm.controls;
    trim(handover.handoverInfo);
    trim(handover.controlQuestion);
    trim(handover.controlAnswer);
    trim(handover.finderEmail);
    trim(handover.finderPhone);
  }

  // Proverava jedan korak i pokazuje greške na njegovim poljima
  private validateStep(id: StepId): boolean {
    this.trimTextFields();

    if (id === 'photo') {
      if (this.photoBusy()) {
        return false;
      }
      if (this.photo() === null) {
        this.photoError.set('Dodaj fotografiju predmeta.');
        return false;
      }
      return true;
    }

    const form = id === 'place' ? this.placeForm : this.handoverForm;
    if (form.invalid) {
      form.markAllAsTouched();
      return false;
    }
    return true;
  }

  // ---------- Korak 1: fotografija ----------

  /**
   * Izabrana fotografija: proverava se vrsta, velika se smanji, pa se proverava veličina.
   * Ako je nova fotografija loša, ostaje prethodna (ako je bilo).
   */
  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Isti fajl može ponovo da se izabere (bez ovoga se "change" ne bi javio)
    input.value = '';
    if (!file) {
      return;
    }

    this.photoError.set('');

    const typeProblem = photoTypeProblem(file);
    if (typeProblem !== null) {
      this.photoError.set(typeProblem);
      return;
    }

    this.photoBusy.set(true);
    const prepared = await preparePhoto(file);
    this.photoBusy.set(false);

    const sizeProblem = photoSizeProblem(prepared);
    if (sizeProblem !== null) {
      this.photoError.set(sizeProblem);
      return;
    }

    this.revokePhotoUrl();
    this.photo.set(prepared);
    this.photoUrl.set(
      typeof URL.createObjectURL === 'function' ? URL.createObjectURL(prepared) : null,
    );
  }

  private revokePhotoUrl(): void {
    const url = this.photoUrl();
    if (url !== null && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }

  // ---------- Korak 2: vreme i mesto ----------

  onMomentChange(value: string): void {
    this.placeForm.controls.foundAt.setValue(value);
    this.placeForm.controls.foundAt.markAsTouched();
  }

  onLocationChange(location: MapLocation | null): void {
    this.mapLocation.set(location);
    this.placeForm.patchValue({
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
    });
    this.placeForm.controls.latitude.markAsTouched();
  }

  // ---------- Korak 3: slanje ----------

  /**
   * Šalje nalaz. Pre toga proverava poslednji korak (i, za svaki slučaj, sve prethodne)
   * i sastavlja zahtev. Predmeti se ne šalju: nalazač ih unosi posle linka iz mejla.
   */
  onSubmit(): void {
    // Dvoklik ne sme da pošalje dva nalaza
    if (this.isSaving()) {
      return;
    }

    this.trimTextFields();
    const invalidStep = this.firstInvalidStep();
    if (invalidStep !== null) {
      this.validateStep(STEPS[invalidStep].id);
      if (invalidStep !== this.stepIndex()) {
        this.goToIndex(invalidStep);
      }
      return;
    }

    const photo = this.photo();
    const place = this.placeForm.getRawValue();
    const handover = this.handoverForm.getRawValue();
    if (photo === null || place.latitude === null || place.longitude === null) {
      return;
    }

    this.isSaving.set(true);
    this.submitErrors.set([]);

    const request: CreateFoundReportRequest = {
      finderEmail: handover.finderEmail.trim(),
      foundAt: new Date(place.foundAt).toISOString(),
      city: place.city.trim(),
      latitude: place.latitude,
      longitude: place.longitude,
      itemLocation: handover.itemLocation as ItemLocation,
      controlQuestion: handover.controlQuestion.trim(),
      controlAnswer: handover.controlAnswer.trim(),
    };

    // Prazna neobavezna polja se izostavljaju, ne šalju se kao ""
    const placeDescription = place.placeDescription.trim();
    if (placeDescription !== '') {
      request.placeDescription = placeDescription;
    }
    const phone = handover.finderPhone.trim();
    if (phone !== '') {
      request.finderPhone = phone;
    }
    // Podaci o predaji samo kad predmet nije kod nalazača (inače ih backend odbija)
    const handoverInfo = handover.handoverInfo.trim();
    if (request.itemLocation !== 'WITH_FINDER' && handoverInfo !== '') {
      request.handoverInfo = handoverInfo;
    }

    this.foundReportService.create(request, photo).subscribe({
      next: (response) => {
        this.isSaving.set(false);
        this.sentTo.set(request.finderEmail);
        this.submitted.set(response);
        this.focusHeading();
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving.set(false);
        this.submitErrors.set(
          apiErrorMessages(error, 'Slanje nalaza nije uspelo. Pokušaj ponovo.'),
        );
      },
    });
  }

  // Indeks prvog koraka koji nije u redu, ili null ako je sve ispravno
  private firstInvalidStep(): number | null {
    if (this.photo() === null) {
      return 0;
    }
    if (this.placeForm.invalid) {
      return 1;
    }
    if (this.handoverForm.invalid) {
      return 2;
    }
    return null;
  }
}
