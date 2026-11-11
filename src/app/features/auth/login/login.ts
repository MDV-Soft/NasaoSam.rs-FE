import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private authService = inject(AuthService);
  private router = inject(Router);

  errorMessage = signal<string>('');
  isLoading = signal<boolean>(false);

  loginForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  onSubmit(): void {
    // Razmaci oko mejla (npr. pri kopiranju) se uklanjaju pre provere
    this.loginForm.controls.email.setValue(this.loginForm.controls.email.value.trim());

    if (this.loginForm.invalid) {
      // Pokaži greške na svim poljima, i na onima koja korisnik nije dirao
      this.loginForm.markAllAsTouched();
      return;
    }

    const email: string = this.loginForm.controls.email.value;
    const password: string = this.loginForm.controls.password.value;

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.login(email, password).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/moji-oglasi']);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);

        if (error.status === 0) {
          // Zahtev nije stigao do servera
          this.errorMessage.set('Server nije dostupan. Proveri da li backend radi.');
        } else if (error.error && error.error.message) {
          // Backend uvek šalje poruku na srpskom, npr. "Pogrešan mejl ili lozinka"
          this.errorMessage.set(error.error.message);
        } else {
          this.errorMessage.set('Prijava nije uspela. Pokušaj ponovo.');
        }
      },
    });
  }
}
