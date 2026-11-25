import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateLostReportRequest, LostReport } from '../models/lost-report.model';
import { LostMatch } from '../models/lost-match.model';
import { resolveApiUrl } from '../utils/api-url';
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

  /**
   * GET /lost-reports/{id}/matches: otvorena poklapanja oglasa, najbolje prvo. Prazna lista znači
   * da poklapanja nema (a za zatvoren ili istekao oglas lista je uvek prazna).
   *
   * Server traži poklapanja sam: kad nalazač potvrdi nalaz i kad vlasnik napravi ili izmeni oglas.
   * Frontend ništa ne okida, samo čita rezultat.
   */
  getMatches(reportId: number): Observable<LostMatch[]> {
    return this.http.get<LostMatch[]>(this.url + '/' + reportId + '/matches');
  }

  /**
   * Zamućena slika nalaza (JPEG, bez keširanja). <img src> ne može da pošalje Authorization
   * zaglavlje, pa se slika učitava kao blob, a komponenta od njega pravi privremenu adresu.
   * photoUrl je putanja koju je dao server; pretvara se u punu adresu backenda (vidi resolveApiUrl).
   */
  getMatchPhoto(photoUrl: string): Observable<Blob> {
    return this.http.get(resolveApiUrl(photoUrl), { responseType: 'blob' });
  }

  /**
   * POST /lost-reports/{id}/matches/{matchId}/dismiss: "Ovo nije moj predmet". Nema tela, a
   * odgovor je 204. Poklapanje nestaje i ne vraća se čak ni kad se oglas ponovo izmeni.
   * Drugi poziv za isto poklapanje je greška "nije pronađeno" (u telu status 404).
   */
  dismissMatch(reportId: number, matchId: number): Observable<void> {
    return this.http.post<void>(
      this.url + '/' + reportId + '/matches/' + matchId + '/dismiss',
      null,
    );
  }
}
