import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import {
  FinderReport,
  FoundReportItemRequest,
  ItemLocation,
  UpdateItemLocationRequest,
} from '../../../core/models/found-report.model';
import { ItemOptions } from '../../../core/models/item-options.model';
import { FinderService } from '../../../core/services/finder.service';
import { FinderSessionService } from '../../../core/services/finder-session.service';
import { MetaService } from '../../../core/services/meta.service';
import { apiErrorMessages, apiErrorStatus } from '../../../core/utils/api-error';
import { ITEM_LOCATION_OPTIONS } from '../../../core/utils/found-report-labels';
import { findLabel, itemTitle } from '../../../core/utils/lost-report-labels';
import { handoverValidator } from '../../../core/validators/found-report-validators';
import { FinderShell } from '../finder-shell/finder-shell';
import { FoundItemsEditor } from '../found-items-editor/found-items-editor';

/**
 * Stranica nalazača posle linka iz mejla: pregled nalaza, opis predmeta, potvrda i povlačenje.
 *
 *  - dok nalaz čeka potvrdu (PENDING_REVIEW): nalazač opisuje predmete (kad AI postoji, tu će
 *    stajati njegov predlog sa slike) i potvrđuje nalaz; tek tada nalaz traži vlasnika
 *  - posle potvrde (ACTIVE): predmeti su samo za pregled, a menja se gde je predmet ili se nalaz povlači
 *  - povučen, istekao ili vraćen nalaz: samo pregled
 *
 * Backend ID nalaza uzima iz nalazačevog tokena, pa ga ova stranica nikad ne zna ni šalje.
 */
@Component({
  selector: 'app-finder-report',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, FinderShell, FoundItemsEditor],
  templateUrl: './finder-report.html',
  styleUrls: ['../finder-controls.css', './finder-report.css'],
})
export class FinderReportPage implements OnInit, OnDestroy {
  private finderService = inject(FinderService);
  private session = inject(FinderSessionService);
  private metaService = inject(MetaService);
  private injector = inject(Injector);

  readonly itemLocations = ITEM_LOCATION_OPTIONS;
  readonly findLabel = findLabel;

  report = signal<FinderReport | null>(null);
  loadError = signal<string>('');
  photoUrl = signal<string | null>(null);
  photoFailed = signal<boolean>(false);

  // Liste za nazive (vrste predmeta, boje...) i za uređivač predmeta
  options = signal<ItemOptions | null>(null);
  optionsFailed = signal<boolean>(false);

  // Do kada važi nalazačev pristup (token traje dva sata)
  accessExpiresAt = signal<Date | null>(this.session.getExpiresAt());

  // Šta se trenutno radi (samo jedna radnja odjednom; dvoklik ne sme da pošalje dva zahteva)
  busy = signal<'save' | 'confirm' | 'location' | 'withdraw' | null>(null);
  actionErrors = signal<string[]>([]);
  // Gde se greška prikazuje: uz predmete, uz izmenu mesta ili uz povlačenje
  errorArea = signal<'items' | 'location' | 'withdraw'>('items');
  // 409: nalaz se u međuvremenu promenio (npr. potvrđen u drugoj kartici); javlja se na vrhu stranice
  staleMessage = signal<string>('');
  itemsSaved = signal<boolean>(false);
  confirmingWithdraw = signal<boolean>(false);

  // Izmena mesta gde je predmet
  editingLocation = signal<boolean>(false);
  locationForm = new FormGroup(
    {
      itemLocation: new FormControl<ItemLocation | ''>('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      handoverInfo: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(255)],
      }),
    },
    { validators: handoverValidator() },
  );

  isPending = computed(() => this.report()?.status === 'PENDING_REVIEW');
  canWithdraw = computed(() => {
    const status = this.report()?.status;
    return status === 'PENDING_REVIEW' || status === 'ACTIVE';
  });

  private heading = viewChild<ElementRef<HTMLElement>>('heading');
  private editor = viewChild(FoundItemsEditor);

  ngOnInit(): void {
    this.loadReport();
    this.loadOptions();
  }

  ngOnDestroy(): void {
    this.revokePhotoUrl();
  }

  loadReport(): void {
    this.loadError.set('');

    this.finderService.getReport().subscribe({
      next: (report) => {
        this.report.set(report);
        if (report.hasPhoto) {
          this.loadPhoto();
        }
      },
      error: (error: HttpErrorResponse) => {
        this.loadError.set(apiErrorMessages(error, 'Nalaz nije učitan. Pokušaj ponovo.')[0]);
      },
    });
  }

  loadOptions(): void {
    this.optionsFailed.set(false);

    this.metaService.getOptions().subscribe({
      next: (options) => this.options.set(options),
      error: () => this.optionsFailed.set(true),
    });
  }

  // Slika je privatna i traži token, pa se učitava kao blob, ne kao običan <img src>
  private loadPhoto(): void {
    this.finderService.getPhoto().subscribe({
      next: (blob) => {
        this.revokePhotoUrl();
        this.photoUrl.set(
          typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : null,
        );
      },
      error: () => this.photoFailed.set(true),
    });
  }

  private revokePhotoUrl(): void {
    const url = this.photoUrl();
    if (url !== null && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }

  // ---------- Nazivi za prikaz ----------

  // "Beograd, na klupi ispred pošte" (opis mesta nije obavezan)
  placeText(report: FinderReport): string {
    return report.placeDescription ? `${report.city}, ${report.placeDescription}` : report.city;
  }

  // "U policiji: PS Vračar, Njegoševa 20" (podaci o predaji postoje samo kad predmet nije kod nalazača)
  itemLocationText(report: FinderReport): string {
    const label = this.itemLocationLabel(report.itemLocation);
    return report.handoverInfo ? `${label}: ${report.handoverInfo}` : label;
  }

  itemLocationLabel(location: ItemLocation): string {
    return this.itemLocations.find((option) => option.value === location)?.label ?? location;
  }

  itemTitle(item: FinderReport['items'][number]): string {
    return itemTitle(item, this.options());
  }

  colorLabel(item: FinderReport['items'][number]): string {
    return findLabel(this.options()?.colors, item.color);
  }

  // ---------- Predmeti i potvrda ----------

  /** Čuva listu predmeta (cela nova lista zamenjuje staru) bez potvrde. */
  async saveItems(): Promise<void> {
    const requests = await this.begin('save');
    if (requests === null) {
      return;
    }

    this.finderService.updateItems(requests).subscribe({
      next: (report) => {
        this.report.set(report);
        this.itemsSaved.set(true);
        this.busy.set(null);
      },
      error: (error: HttpErrorResponse) => this.failAction(error, 'Čuvanje predmeta nije uspelo.'),
    });
  }

  /** Čuva predmete, pa potvrđuje nalaz: od tog trenutka nalaz traži vlasnika. */
  async confirm(): Promise<void> {
    const requests = await this.begin('confirm');
    if (requests === null) {
      return;
    }

    this.finderService
      .updateItems(requests)
      .pipe(switchMap(() => this.finderService.confirm()))
      .subscribe({
        next: (report) => {
          this.report.set(report);
          this.busy.set(null);
          this.focusHeading();
        },
        error: (error: HttpErrorResponse) => this.failAction(error, 'Potvrda nalaza nije uspela.'),
      });
  }

  /**
   * Počinje radnju nad predmetima: proverava uređivač, ODMAH zaključava dugmad (pre bilo kakvog
   * čekanja, da dvoklik ne pošalje dva zahteva), pa pravi zahtev (heševi imena, asinhrono).
   * Vraća null ako nešto nije u redu ili je druga radnja u toku.
   */
  private async begin(action: 'save' | 'confirm'): Promise<FoundReportItemRequest[] | null> {
    const editor = this.editor();
    if (this.busy() !== null || editor === undefined || !editor.validate()) {
      return null;
    }

    this.startAction(action);
    try {
      return await editor.buildRequests();
    } catch (error) {
      this.busy.set(null);
      this.actionErrors.set([
        error instanceof Error ? error.message : 'Priprema predmeta nije uspela.',
      ]);
      return null;
    }
  }

  // ---------- Mesto gde je predmet ----------

  startEditLocation(): void {
    const report = this.report();
    if (report === null) {
      return;
    }

    this.locationForm.setValue({
      itemLocation: report.itemLocation,
      handoverInfo: report.handoverInfo ?? '',
    });
    this.actionErrors.set([]);
    this.editingLocation.set(true);
  }

  cancelEditLocation(): void {
    this.editingLocation.set(false);
  }

  saveLocation(): void {
    if (this.busy() !== null) {
      return;
    }

    const handoverControl = this.locationForm.controls.handoverInfo;
    handoverControl.setValue(handoverControl.value.trim());
    if (this.locationForm.invalid) {
      this.locationForm.markAllAsTouched();
      return;
    }

    const value = this.locationForm.getRawValue();
    const request: UpdateItemLocationRequest = { itemLocation: value.itemLocation as ItemLocation };
    // Podaci o predaji samo kad predmet nije kod nalazača (inače ih backend odbija)
    if (request.itemLocation !== 'WITH_FINDER' && value.handoverInfo !== '') {
      request.handoverInfo = value.handoverInfo;
    }

    this.startAction('location');
    this.finderService.updateItemLocation(request).subscribe({
      next: (report) => {
        this.report.set(report);
        this.editingLocation.set(false);
        this.busy.set(null);
      },
      error: (error: HttpErrorResponse) => this.failAction(error, 'Izmena nije uspela.'),
    });
  }

  // ---------- Povlačenje ----------

  // Prvi klik samo traži potvrdu: povlačenje se ne može poništiti
  askWithdraw(): void {
    this.actionErrors.set([]);
    this.confirmingWithdraw.set(true);
  }

  cancelWithdraw(): void {
    this.confirmingWithdraw.set(false);
  }

  withdraw(): void {
    if (this.busy() !== null) {
      return;
    }

    this.startAction('withdraw');
    this.finderService.withdraw().subscribe({
      next: (report) => {
        this.report.set(report);
        this.confirmingWithdraw.set(false);
        this.busy.set(null);
        this.focusHeading();
      },
      error: (error: HttpErrorResponse) => {
        this.confirmingWithdraw.set(false);
        this.failAction(error, 'Povlačenje nalaza nije uspelo.');
      },
    });
  }

  // ---------- Zajedničko ----------

  private startAction(action: 'save' | 'confirm' | 'location' | 'withdraw'): void {
    this.busy.set(action);
    this.errorArea.set(action === 'confirm' || action === 'save' ? 'items' : action);
    this.actionErrors.set([]);
    this.staleMessage.set('');
    this.itemsSaved.set(false);
  }

  private failAction(error: HttpErrorResponse, fallback: string): void {
    this.busy.set(null);
    const messages = apiErrorMessages(error, fallback);

    // 409: nalaz je u međuvremenu promenio stanje (npr. potvrđen u drugoj kartici). Prikaz je
    // zastareo, pa se učitava ponovo, a poruka ide na vrh stranice jer se odeljak sa greškom može
    // promeniti ili nestati.
    if (apiErrorStatus(error) === 409) {
      this.staleMessage.set(messages[0]);
      this.actionErrors.set([]);
      this.editingLocation.set(false);
      this.loadReport();
      return;
    }
    this.actionErrors.set(messages);
  }

  private focusHeading(): void {
    afterNextRender(() => this.heading()?.nativeElement.focus(), { injector: this.injector });
  }
}
