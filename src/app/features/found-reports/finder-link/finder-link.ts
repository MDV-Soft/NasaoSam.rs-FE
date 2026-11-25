import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FinderService } from '../../../core/services/finder.service';
import { FinderSessionService } from '../../../core/services/finder-session.service';
import { apiErrorMessages } from '../../../core/utils/api-error';
import { PageShell } from '../../shared/page-shell/page-shell';

type LinkState = 'opening' | 'failed' | 'missing';

/**
 * Ulaz za nalazača: otvara se linkom iz mejla (/nalaz?token=...).
 *
 * Token iz linka se odmah uklanja iz adrese (da ne ostane u istoriji browsera), pa se menja za
 * privremeni token nalazača i otvara se stranica za pregled. Ako link ne radi, ili nema tokena
 * (npr. istekla sesija), ovde se objašnjava šta da se uradi.
 */
@Component({
  selector: 'app-finder-link',
  imports: [RouterLink, PageShell],
  templateUrl: './finder-link.html',
  styleUrls: ['../../shared/page-controls.css', './finder-link.css'],
})
export class FinderLink implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private finderService = inject(FinderService);
  private session = inject(FinderSessionService);

  state = signal<LinkState>('opening');
  message = signal<string>('');
  // Greška bez odgovora servera (nema veze) se može ponoviti istim linkom
  canRetry = signal<boolean>(false);

  private token: string | null = null;

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token')?.trim() || null;

    if (this.token !== null) {
      // Tajni token ne sme da ostane u adresi, istoriji browsera i zaglavlju "Referer"
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      this.open();
    } else if (this.session.isActive()) {
      this.router.navigate(['/nalaz/pregled'], { replaceUrl: true });
    } else {
      this.state.set('missing');
    }
  }

  open(): void {
    if (this.token === null) {
      return;
    }

    this.state.set('opening');
    this.canRetry.set(false);

    this.finderService.openLink(this.token).subscribe({
      next: () => this.router.navigate(['/nalaz/pregled'], { replaceUrl: true }),
      error: (error: HttpErrorResponse) => {
        this.message.set(apiErrorMessages(error, 'Link nije ispravan ili je istekao')[0]);
        this.canRetry.set(error.status === 0);
        this.state.set('failed');
      },
    });
  }
}
