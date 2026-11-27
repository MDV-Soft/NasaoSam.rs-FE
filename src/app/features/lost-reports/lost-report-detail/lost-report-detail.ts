import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ItemOptions } from '../../../core/models/item-options.model';
import { LostMatch } from '../../../core/models/lost-match.model';
import { LostReport, LostReportItem } from '../../../core/models/lost-report.model';
import { LostReportService } from '../../../core/services/lost-report.service';
import { MetaService } from '../../../core/services/meta.service';
import { apiErrorMessages, apiErrorStatus } from '../../../core/utils/api-error';
import { itemTitle, searchAreaText, statusLabel } from '../../../core/utils/lost-report-labels';
import { matchesCount } from '../../../core/utils/plural';
import { PageShell } from '../../shared/page-shell/page-shell';
import { MatchCard } from '../match-card/match-card';

interface ItemMatches {
  item: LostReportItem;
  matches: LostMatch[];
}

/**
 * Detalj jednog oglasa (/moji-oglasi/:id): šta je vlasnik prijavio i poklapanja koja je server našao.
 *
 * Server traži poklapanja sam (kad nalazač potvrdi nalaz i kad se oglas napravi ili izmeni), a
 * obaveštenja na mejl još nema, pa vlasnik poklapanja vidi tek kad otvori ovu stranicu. Zato
 * postoji "Proveri ponovo".
 *
 * Poklapanja se prikazuju uz predmet iz oglasa koji se poklopio (oglas može imati više predmeta).
 */
@Component({
  selector: 'app-lost-report-detail',
  imports: [DatePipe, RouterLink, PageShell, MatchCard],
  templateUrl: './lost-report-detail.html',
  styleUrls: ['../../shared/page-controls.css', './lost-report-detail.css'],
})
export class LostReportDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private lostReportService = inject(LostReportService);
  private metaService = inject(MetaService);

  readonly statusLabel = statusLabel;
  readonly matchesCount = matchesCount;

  // Broj oglasa iz adrese. Pamti se zasebno, jer "Pokušaj ponovo" posle neuspelog učitavanja
  // nema oglas iz kog bi ga uzeo.
  private reportId = 0;

  report = signal<LostReport | null>(null);
  // Oglas ne postoji ili nije vlasnikov (server za oba kaže "nije pronađen")
  notFound = signal<boolean>(false);
  loadError = signal<string>('');

  options = signal<ItemOptions | null>(null);

  // null = još se učitava (ili oglas nije aktivan, pa se poklapanja i ne traže)
  matches = signal<LostMatch[] | null>(null);
  matchesError = signal<string>('');
  checking = signal<boolean>(false);
  removedNotice = signal<boolean>(false);

  isActive = computed(() => this.report()?.status === 'ACTIVE');

  // Gde se traže nalazi ("u krugu od 1 km oko tačke koju si označio"): vlasnik treba da zna zašto
  // poklapanja nema, jer nalaz van kruga se ne poklapa nikad, koliko god mu se ostalo slaže
  searchArea = computed(() => {
    const report = this.report();
    return report === null ? '' : searchAreaText(report);
  });

  // Ista rečenica sa velikim početnim slovom, za red u tabeli
  searchAreaLabel = computed(() => {
    const text = this.searchArea();
    return text.charAt(0).toUpperCase() + text.slice(1);
  });
  total = computed(() => this.matches()?.length ?? 0);

  // Predmeti oglasa sa svojim poklapanjima (samo oni koji ih imaju)
  withMatches = computed<ItemMatches[]>(() => {
    const report = this.report();
    const matches = this.matches();
    if (report === null || matches === null) {
      return [];
    }
    return report.items
      .map((item) => ({ item, matches: matches.filter((match) => match.lostItemId === item.id) }))
      .filter((group) => group.matches.length > 0);
  });

  // Predmeti bez poklapanja, nabrojani jednom linijom
  withoutMatches = computed<LostReportItem[]>(() => {
    const report = this.report();
    const matches = this.matches();
    if (report === null || matches === null) {
      return [];
    }
    return report.items.filter((item) => !matches.some((match) => match.lostItemId === item.id));
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      this.notFound.set(true);
      return;
    }
    this.reportId = id;

    this.metaService.getOptions().subscribe({
      next: (options) => this.options.set(options),
      // Liste služe samo za lepe nazive; ako ne stignu, prikazuju se tehničke vrednosti
      error: () => undefined,
    });
    this.loadReport();
  }

  loadReport(): void {
    this.loadError.set('');

    this.lostReportService.getById(this.reportId).subscribe({
      next: (report) => {
        this.report.set(report);
        // Za zatvoren, istekao ili vraćen oglas poklapanja se ne traže (server vraća praznu listu)
        if (report.status === 'ACTIVE') {
          this.loadMatches();
        }
      },
      error: (error: HttpErrorResponse) => {
        if (apiErrorStatus(error) === 404) {
          this.notFound.set(true);
          return;
        }
        this.loadError.set(apiErrorMessages(error, 'Oglas nije učitan. Pokušaj ponovo.')[0]);
      },
    });
  }

  // "Proveri ponovo": server je mogao da nađe nova poklapanja od poslednjeg otvaranja
  loadMatches(): void {
    const report = this.report();
    if (report === null || this.checking()) {
      return;
    }

    this.checking.set(true);
    this.matchesError.set('');
    this.removedNotice.set(false);

    this.lostReportService.getMatches(report.id).subscribe({
      next: (matches) => {
        this.matches.set(matches);
        this.checking.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.matchesError.set(
          apiErrorMessages(error, 'Poklapanja nisu učitana. Pokušaj ponovo.')[0],
        );
        this.checking.set(false);
      },
    });
  }

  // Kartica je javila da je poklapanje uklonjeno: sklanja se iz liste bez ponovnog učitavanja
  onDismissed(matchId: number): void {
    this.matches.update((list) =>
      list === null ? list : list.filter((m) => m.matchId !== matchId),
    );
    this.removedNotice.set(true);
  }

  // "Niš, kod autobuske stanice" (opis mesta nije obavezan)
  placeText(report: LostReport): string {
    return report.placeDescription ? `${report.city}, ${report.placeDescription}` : report.city;
  }

  itemTitle(item: LostReportItem): string {
    return itemTitle(item, this.options());
  }
}
