import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { User } from '../models/user.model';
import { AuthResponse } from '../models/auth-response.model';
import { RegisterRequest } from '../models/register-request.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl: string = environment.apiUrl;
  private http = inject(HttpClient);

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(this.apiUrl + '/auth/login', {
        email: email,
        password: password,
      })
      .pipe(tap((response) => this.saveSession(response)));
  }

  // Backend posle uspešne registracije odmah vraća token, pa je korisnik i prijavljen
  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(this.apiUrl + '/auth/register', request)
      .pipe(tap((response) => this.saveSession(response)));
  }

  // Zajedničko za login i registraciju: čuva token i podatke o korisniku
  private saveSession(response: AuthResponse): void {
    this.saveToken(response.token);
    this.saveUser({
      id: response.userId,
      email: response.email,
      role: response.role,
    });
  }

  // Javlja backendu da poništi token, pa briše sesiju u browseru.
  // Sesija se briše i kad backend ne odgovori (npr. token je već istekao ili nema mreže):
  // korisnik je kliknuo "Odjavi se" i mora da bude odjavljen u svakom slučaju.
  logout(): Observable<void> {
    return this.http.post<void>(this.apiUrl + '/auth/logout', {}).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
      tap(() => this.clearSession()),
    );
  }

  saveToken(token: string): void {
    localStorage.setItem('api_token', token);
  }

  getToken(): string | null {
    return localStorage.getItem('api_token');
  }

  saveUser(user: User): void {
    localStorage.setItem('current_user', JSON.stringify(user));
  }

  getUser(): User | null {
    const storedUser = localStorage.getItem('current_user');

    if (storedUser == null) {
      return null;
    }

    return JSON.parse(storedUser);
  }

  clearSession(): void {
    localStorage.removeItem('api_token');
    localStorage.removeItem('current_user');
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    return token != null;
  }
}
