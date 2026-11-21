import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateFoundReportRequest, FoundReportSubmitted } from '../models/found-report.model';
import { environment } from '../../../environments/environment';

/**
 * Prijava nalaza (/api/found-reports). Ruta je javna: nalazač nema nalog.
 * Zato je authInterceptor ne tretira kao zaštićenu (token se ne šalje).
 *
 * Servis ne hvata greške: prosleđuje ih komponenti, koja zna šta da pokaže korisniku.
 */
@Injectable({
  providedIn: 'root',
})
export class FoundReportService {
  private http = inject(HttpClient);
  private url: string = environment.apiUrl + '/found-reports';

  /**
   * POST /found-reports (201, multipart/form-data):
   *  - "report": JSON, mora imati tip application/json (inače backend vraća 415)
   *  - "photo":  slika (JPEG ili PNG, najviše 5 MB)
   *
   * Content-Type se NE postavlja ručno: browser ga sam pravi, zajedno sa granicom između delova.
   */
  create(request: CreateFoundReportRequest, photo: File): Observable<FoundReportSubmitted> {
    const body = new FormData();
    body.append('report', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    body.append('photo', photo, photo.name);

    return this.http.post<FoundReportSubmitted>(this.url, body);
  }
}
