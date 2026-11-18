import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { ItemOptions } from '../models/item-options.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MetaService {
  private http = inject(HttpClient);
  private apiUrl: string = environment.apiUrl;

  // Liste (vrste predmeta, boje...) se ne menjaju dok je aplikacija otvorena,
  // pa ih tražimo od servera najviše jednom, a svi ostali dobijaju zapamćen odgovor.
  // Zahtev se šalje tek kad se neko prvi put pretplati (Observable je "recept").
  private readonly options$: Observable<ItemOptions> = this.http
    .get<ItemOptions>(this.apiUrl + '/meta/options')
    .pipe(shareReplay(1));

  getOptions(): Observable<ItemOptions> {
    return this.options$;
  }
}
