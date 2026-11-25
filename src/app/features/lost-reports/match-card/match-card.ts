import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ItemOptions } from '../../../core/models/item-options.model';
import { LostMatch } from '../../../core/models/lost-match.model';
import { LostReportService } from '../../../core/services/lost-report.service';
import { apiErrorMessages, apiErrorStatus } from '../../../core/utils/api-error';
import { confidenceLabel, confidenceLevel } from '../../../core/utils/match-labels';
import { findLabel, itemTitle } from '../../../core/utils/lost-report-labels';
import { describeDay } from '../../../core/utils/moment';

type PhotoState = 'none' | 'loading' | 'ready' | 'failed';

/**
 * Jedno poklapanje: zamućena fotografija nalaza, šta je pronađeno, gde i kog dana, koliko je
 * verovatno, i "Ovo nije moj predmet".
 *
 * Vlasnik NIKAD ne vidi kontakt nalazača, tačnu lokaciju, marku, opis ni kontrolno pitanje:
 * server to ne šalje, jer se dobija tek posle provere vlasništva.
 *
 * Fotografija se učitava kao blob (<img src> ne može da pošalje Authorization zaglavlje).
 */
@Component({
  selector: 'app-match-card',
  templateUrl: './match-card.html',
  styleUrls: ['../../shared/page-controls.css', './match-card.css'],
})
export class MatchCard implements OnInit, OnDestroy {
  private lostReportService = inject(LostReportService);

  match = input.required<LostMatch>();
  reportId = input.required<number>();
  // Liste sa servera služe za lepe nazive; bez njih se prikazuju tehničke vrednosti
  options = input<ItemOptions | null>(null);

  // Javlja roditelju da je poklapanje uklonjeno ("Ovo nije moj predmet" je uspelo)
  dismissed = output<number>();

  photoUrl = signal<string | null>(null);
  photoState = signal<PhotoState>('none');

  confirming = signal<boolean>(false);
  busy = signal<boolean>(false);
  errors = signal<string[]>([]);

  title = computed(() => itemTitle(this.match(), this.options()));
  colorText = computed(() => findLabel(this.options()?.colors, this.match().color));
  // "juče" ili "25. novembar 2026."
  foundText = computed(() => describeDay(this.match().foundDate, new Date()));
  label = computed(() => confidenceLabel(this.match().confidence));
  level = computed(() => confidenceLevel(this.match().confidence));

  ngOnInit(): void {
    const url = this.match().photoUrl;
    if (url === null) {
      return;
    }

    this.photoState.set('loading');
    this.lostReportService.getMatchPhoto(url).subscribe({
      next: (blob) => {
        if (typeof URL.createObjectURL !== 'function') {
          this.photoState.set('failed');
          return;
        }
        this.photoUrl.set(URL.createObjectURL(blob));
        this.photoState.set('ready');
      },
      error: () => this.photoState.set('failed'),
    });
  }

  ngOnDestroy(): void {
    const url = this.photoUrl();
    if (url !== null && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }

  // Prvi klik samo traži potvrdu: poklapanje se posle toga ne vraća ni kad se oglas izmeni
  askDismiss(): void {
    this.errors.set([]);
    this.confirming.set(true);
  }

  cancelDismiss(): void {
    this.confirming.set(false);
  }

  dismiss(): void {
    // Dvoklik ne sme da pošalje dva zahteva
    if (this.busy()) {
      return;
    }

    this.busy.set(true);
    this.errors.set([]);

    this.lostReportService.dismissMatch(this.reportId(), this.match().matchId).subscribe({
      next: () => this.dismissed.emit(this.match().matchId),
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);

        // Već uklonjeno (npr. u drugoj kartici): vlasnik je hteo baš to, pa se poklapanje samo sklanja
        if (apiErrorStatus(error) === 404) {
          this.dismissed.emit(this.match().matchId);
          return;
        }
        this.confirming.set(false);
        this.errors.set(apiErrorMessages(error, 'Uklanjanje nije uspelo. Pokušaj ponovo.'));
      },
    });
  }
}
