import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Zajednički okvir stranica sa mirnom pozadinom (prijava nalaza, stranice nalazača, detalj oglasa):
 * gornja traka sa nazivom i jednim linkom za povratak, pa kolona sadržaja.
 * Sadržaj stranice se ubacuje unutra.
 *
 * Link za povratak je podrazumevano "← Početna", a stranica ga može promeniti
 * (npr. detalj oglasa vodi nazad na "← Moji oglasi").
 */
@Component({
  selector: 'app-page-shell',
  imports: [RouterLink],
  templateUrl: './page-shell.html',
  styleUrl: './page-shell.css',
})
export class PageShell {
  backLink = input<string>('/');
  backLabel = input<string>('← Početna');
}
