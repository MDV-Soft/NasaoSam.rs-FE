import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { User } from '../models/user.model';
import { AuthResponse } from '../models/auth-response.model';
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
      .pipe(
        tap((response) => {
          this.saveToken(response.token);
          this.saveUser({
            id: response.userId,
            email: response.email,
            role: response.role,
          });
        }),
      );
  }

  // Backend nema rutu za odjavu (token važi sam od sebe), pa se samo briše sesija u browseru
  logout(): void {
    this.clearSession();
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
