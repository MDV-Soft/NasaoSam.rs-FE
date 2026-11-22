import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Zajednički okvir stranica nalazača (prijava nalaza, otvaranje linka, pregled nalaza):
 * gornja traka sa nazivom i povratkom na početnu, mirna pozadina i kolona sadržaja.
 * Sadržaj stranice se ubacuje unutra.
 */
@Component({
  selector: 'app-finder-shell',
  imports: [RouterLink],
  templateUrl: './finder-shell.html',
  styleUrl: './finder-shell.css',
})
export class FinderShell {}
