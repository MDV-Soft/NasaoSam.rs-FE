import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import {
  FinderAccess,
  FinderReport,
  FoundReportItemRequest,
  UpdateItemLocationRequest,
} from '../models/found-report.model';
import { FinderSessionService } from './finder-session.service';
import { environment } from '../../../environments/environment';

/**
 * Šta nalazač radi sa svojim nalazom (/api/finder/...).
 *
 * Servis NE dodaje token (to radi authInterceptor, iz nalazačeve sesije) i NE hvata greške.
 * Backend ID nalaza uzima iz tokena, pa se nikad ne šalje u zahtevu.
 * Većina poziva vraća ceo nalaz posle izmene.
 */
@Injectable({
  providedIn: 'root',
})
export class FinderService {
  private http = inject(HttpClient);
  private session = inject(FinderSessionService);
  private url: string = environment.apiUrl + '/finder';

  /**
   * POST /finder/access: token iz linka u mejlu zamenjuje privremenim tokenom nalazača,
   * koji se odmah čuva u sesiji. Prvo otvaranje prebacuje nalaz iz PENDING_EMAIL u PENDING_REVIEW.
   * Greška 400 znači da link nije ispravan, da je istekao (24 sata) ili da je nalaz već potvrđen.
   */
  openLink(token: string): Observable<FinderAccess> {
    return this.http
      .post<FinderAccess>(this.url + '/access', { token })
      .pipe(tap((access) => this.session.save(access.accessToken, access.expiresAt)));
  }

  // GET /finder/report: dozvoljeno u svakom statusu
  getReport(): Observable<FinderReport> {
    return this.http.get<FinderReport>(this.url + '/report');
  }

  // GET /finder/report/photo: slika je privatna (JPEG, bez keširanja) i traži token, pa ide kao blob
  getPhoto(): Observable<Blob> {
    return this.http.get(this.url + '/report/photo', { responseType: 'blob' });
  }

  // PUT /finder/report/items: cela nova lista zamenjuje staru, samo pre potvrde (inače 409), bar jedan predmet
  updateItems(items: FoundReportItemRequest[]): Observable<FinderReport> {
    return this.http.put<FinderReport>(this.url + '/report/items', { items });
  }

  // PUT /finder/report/item-location: pre i posle potvrde, dok nalaz nije završen
  updateItemLocation(request: UpdateItemLocationRequest): Observable<FinderReport> {
    return this.http.put<FinderReport>(this.url + '/report/item-location', request);
  }

  // POST /finder/report/confirm: PENDING_REVIEW → ACTIVE (60 dana), traži bar jedan predmet
  confirm(): Observable<FinderReport> {
    return this.http.post<FinderReport>(this.url + '/report/confirm', {});
  }

  // POST /finder/report/withdraw: povlači nalaz dok nije završen
  withdraw(): Observable<FinderReport> {
    return this.http.post<FinderReport>(this.url + '/report/withdraw', {});
  }
}
