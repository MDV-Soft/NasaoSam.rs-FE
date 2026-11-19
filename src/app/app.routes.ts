import { Routes } from '@angular/router';
import { Landing } from './features/landing/landing/landing';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { LostReportList } from './features/lost-reports/lost-report-list/lost-report-list';
import { LostReportForm } from './features/lost-reports/lost-report-form/lost-report-form';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';

export const routes: Routes = [
  // Prva stranica koja se prikazuje kad se aplikacija pokrene
  { path: '', component: Landing },
  // Prijavljen korisnik nema šta da traži na loginu
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: 'registracija', component: Register, canActivate: [guestGuard] },
  // Samo za prijavljene
  { path: 'moji-oglasi', component: LostReportList, canActivate: [authGuard] },
  { path: 'novi-oglas', component: LostReportForm, canActivate: [authGuard] },
  // Svaka nepoznata adresa vodi na početnu (MORA biti poslednja)
  { path: '**', redirectTo: '' },
];
