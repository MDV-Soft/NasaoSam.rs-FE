import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateLostReportRequest, LostReport } from '../models/lost-report.model';
import { environment } from '../../../environments/environment';

/**
 * Komunikacija sa backendom za oglase izgubljenih predmeta (/api/lost-reports).
 *
 * Servis NE dodaje token (to radi authInterceptor) i NE hvata greške:
 * greške prosleđuje komponenti, jer samo komponenta zna šta da pokaže korisniku.
 * Backend ID vlasnika uzima iz tokena, pa se nikad ne šalje u zahtevu.
 */
@Injectable({
  providedIn: 'root',
})
export class LostReportService {
  private http = inject(HttpClient);
  private url: string = environment.apiUrl + '/lost-reports';

  // POST /lost-reports (201): pravi nov oglas i vraća ga sa dodeljenim id-jem i ocenom kompletnosti
  create(request: CreateLostReportRequest): Observable<LostReport> {
    return this.http.post<LostReport>(this.url, request);
  }

  // GET /lost-reports: svi oglasi PRIJAVLJENOG korisnika, od najnovijeg ka najstarijem
  getMine(): Observable<LostReport[]> {
    return this.http.get<LostReport[]>(this.url);
  }

  // GET /lost-reports/{id}: jedan oglas (404 ako ne postoji ili nije tvoj)
  getById(id: number): Observable<LostReport> {
    return this.http.get<LostReport>(this.url + '/' + id);
  }

  /**
   * PUT /lost-reports/{id}: izmena AKTIVNOG oglasa (inače 409).
   * Šalje se ceo oglas, a ne samo ono što se promenilo. Pravila za predmete:
   *  - predmet SA id-jem: menja se postojeći
   *  - predmet BEZ id-ja: dodaje se novi
   *  - predmet koji se NE pošalje: briše se
   *  - za dokument bez heševa: stari heševi ostaju (backend ih ne briše)
   */
  update(id: number, request: CreateLostReportRequest): Observable<LostReport> {
    return this.http.put<LostReport>(this.url + '/' + id, request);
  }

  // POST /lost-reports/{id}/close: zatvara oglas (409 ako više nije aktivan). Nema tela.
  close(id: number): Observable<LostReport> {
    return this.http.post<LostReport>(this.url + '/' + id + '/close', {});
  }
}
