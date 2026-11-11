import { Routes } from '@angular/router';
import { Landing } from './features/landing/landing/landing';
import { Login } from './features/auth/login/login';
import { LostReportList } from './features/lost-reports/lost-report-list/lost-report-list';

export const routes: Routes = [
  // Prva stranica koja se prikazuje kad se aplikacija pokrene
  { path: '', component: Landing },
  { path: 'login', component: Login },
  { path: 'moji-oglasi', component: LostReportList },
  // Svaka nepoznata adresa vodi na početnu (MORA biti poslednja)
  { path: '**', redirectTo: '' },
];
