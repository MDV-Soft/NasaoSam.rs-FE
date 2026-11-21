import { Routes } from '@angular/router';
import { Landing } from './features/landing/landing/landing';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { LostReportList } from './features/lost-reports/lost-report-list/lost-report-list';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';

export const routes: Routes = [
  // Prva stranica koja se prikazuje kad se aplikacija pokrene
  { path: '', component: Landing },
  // Prijavljen korisnik nema šta da traži na loginu
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: 'registracija', component: Register, canActivate: [guestGuard] },
  // Nalazač nema nalog: prijava nalaza je javna. Učitava se tek kad zatreba (u njoj je mapa).
  {
    path: 'nasao-sam',
    loadComponent: () =>
      import('./features/found-reports/found-report-form/found-report-form').then(
        (m) => m.FoundReportForm,
      ),
  },
  // Samo za prijavljene
  { path: 'moji-oglasi', component: LostReportList, canActivate: [authGuard] },
  // Forma sa mapom (Leaflet) se učitava tek kad se otvori, da početna stranica ostane laka
  {
    path: 'novi-oglas',
    loadComponent: () =>
      import('./features/lost-reports/lost-report-form/lost-report-form').then(
        (m) => m.LostReportForm,
      ),
    canActivate: [authGuard],
  },
  // Svaka nepoznata adresa vodi na početnu (MORA biti poslednja)
  { path: '**', redirectTo: '' },
];
