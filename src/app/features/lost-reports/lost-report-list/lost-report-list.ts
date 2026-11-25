import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ItemOptions } from '../../../core/models/item-options.model';
import { MatchConfidence } from '../../../core/models/lost-match.model';
import { LostReport, LostReportItem } from '../../../core/models/lost-report.model';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { LostReportService } from '../../../core/services/lost-report.service';
import { MetaService } from '../../../core/services/meta.service';
import { findLabel, itemTitle, statusLabel } from '../../../core/utils/lost-report-labels';
import { bestConfidence, confidenceLabel } from '../../../core/utils/match-labels';
import { matchesCount } from '../../../core/utils/plural';

// Šta se zna o poklapanjima jednog oglasa (za broj na kartici)
interface MatchSummary {
  state: 'loading' | 'ready' | 'failed';
  count: number;
  best: MatchConfidence | null;
}

@Component({
  selector: 'app-lost-report-list',
  imports: [RouterLink, DatePipe],
  templateUrl: './lost-report-list.html',
  styleUrl: './lost-report-list.css',
})
export class LostReportList {
  private authService = inject(AuthService);
  private lostReportService = inject(LostReportService);
  private metaService = inject(MetaService);
  private router = inject(Router);

  // Podaci o prijavljenom korisniku, sačuvani pri prijavi
  user: User | null = this.authService.getUser();

  // Funkcije za nazive, dostupne šablonu
  readonly statusLabel = statusLabel;
  readonly matchesCount = matchesCount;
  readonly confidenceLabel = confidenceLabel;

  // Poklapanja po oglasu (samo za aktivne). Server ih traži sam; frontend ih samo čita.
  matchSummaries = signal<Record<number, MatchSummary>>({});

  // null = još se učitava
  reports = signal<LostReport[] | null>(null);
  loadFailed = signal<boolean>(false);

  // Liste sa servera služe samo za lepe nazive; ako ne stignu, prikazuju se tehničke vrednosti
  options = signal<ItemOptions | null>(null);

  // Oglas za koji se traži potvrda zatvaranja, i oglas čije zatvaranje trenutno traje
  confirmingId = signal<number | null>(null);
  closingId = signal<number | null>(null);
  actionError = signal<string>('');

  constructor() {
    this.loadReports();
    this.metaService.getOptions().subscribe({
      next: (options) => this.options.set(options),
      error: () => undefined,
    });
  }

  loadReports(): void {
    this.loadFailed.set(false);

    this.lostReportService.getMine().subscribe({
      next: (reports) => {
        this.reports.set(reports);
        this.loadMatchSummaries(reports);
      },
      error: () => this.loadFailed.set(true),
    });
  }

  /**
   * Za svaki aktivan oglas pita server za poklapanja, da kartica može da kaže "2 poklapanja".
   * Za zatvoren, istekao ili vraćen oglas poklapanja se ne traže. Ako poziv ne uspe, kartica
   * jednostavno ne prikazuje broj: lista oglasa ne sme da zavisi od poklapanja.
   */
  private loadMatchSummaries(reports: LostReport[]): void {
    const active = reports.filter((report) => report.status === 'ACTIVE');

    this.matchSummaries.set(
      Object.fromEntries(
        active.map((report) => [
          report.id,
          { state: 'loading', count: 0, best: null } as MatchSummary,
        ]),
      ),
    );

    active.forEach((report) => {
      this.lostReportService.getMatches(report.id).subscribe({
        next: (matches) =>
          this.setMatchSummary(report.id, {
            state: 'ready',
            count: matches.length,
            best: bestConfidence(matches),
          }),
        error: () => this.setMatchSummary(report.id, { state: 'failed', count: 0, best: null }),
      });
    });
  }

  private setMatchSummary(reportId: number, summary: MatchSummary): void {
    this.matchSummaries.update((all) => ({ ...all, [reportId]: summary }));
  }

  itemTitle(item: LostReportItem): string {
    return itemTitle(item, this.options());
  }

  colorLabel(item: LostReportItem): string {
    return findLabel(this.options()?.colors, item.color);
  }

  // Prvi klik na "Zatvori oglas" samo traži potvrdu: zatvaranje se ne može poništiti
  askClose(reportId: number): void {
    this.actionError.set('');
    this.confirmingId.set(reportId);
  }

  cancelClose(): void {
    this.confirmingId.set(null);
  }

  confirmClose(reportId: number): void {
    // Dvoklik ne sme da pošalje dva zahteva
    if (this.closingId() !== null) {
      return;
    }

    this.closingId.set(reportId);
    this.actionError.set('');

    this.lostReportService.close(reportId).subscribe({
      next: (updated) => {
        // Server vraća ažuriran oglas: zamenjujemo stari u listi, bez ponovnog učitavanja svih
        this.reports.update((list) =>
          list === null
            ? list
            : list.map((report) => (report.id === updated.id ? updated : report)),
        );
        this.closingId.set(null);
        this.confirmingId.set(null);
      },
      error: (error: HttpErrorResponse) => {
        this.closingId.set(null);
        this.confirmingId.set(null);
        this.actionError.set(this.describeCloseError(error));

        // 409: oglas više nije aktivan (npr. zatvoren u drugoj kartici). Lista je zastarela.
        if ((error.error?.status ?? error.status) === 409) {
          this.loadReports();
        }
      },
    });
  }

  onLogout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/']);
    });
  }

  private describeCloseError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Server nije dostupan. Proveri da li backend radi.';
    }
    return error.error?.message ?? 'Zatvaranje oglasa nije uspelo. Pokušaj ponovo.';
  }
}
