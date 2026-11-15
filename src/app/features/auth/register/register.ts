import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { RegisterRequest } from '../../../core/models/register-request.model';
import {
  passwordsMatchValidator,
  serbianMobileValidator,
} from '../../../core/validators/form-validators';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private authService = inject(AuthService);
  private router = inject(Router);

  errorMessage = signal<string>('');
  isLoading = signal<boolean>(false);

  // Ograničenja (255, 72, 100, 30) su ista kao u RegisterRequest na backendu
  registerForm = new FormGroup(
    {
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email, Validators.maxLength(255)],
      }),
      displayName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(100)],
      }),
      phone: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(30), serbianMobileValidator()],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8), Validators.maxLength(72)],
      }),
      // Postoji samo na frontendu, backend ga nikad ne dobija
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordsMatchValidator() },
  );

  onSubmit(): void {
    // Razmaci oko mejla, imena i telefona (npr. pri kopiranju) se uklanjaju pre provere.
    // Lozinka se NE trimuje: razmak u njoj može biti namerno.
    const controls = this.registerForm.controls;
    controls.email.setValue(controls.email.value.trim());
    controls.displayName.setValue(controls.displayName.value.trim());
    controls.phone.setValue(controls.phone.value.trim());

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const request: RegisterRequest = {
      email: controls.email.value,
      password: controls.password.value,
      phone: controls.phone.value,
    };
    // Prazno ime se ne šalje uopšte (backend ga tretira kao neobavezno)
    if (controls.displayName.value !== '') {
      request.displayName = controls.displayName.value;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.register(request).subscribe({
      next: () => {
        this.isLoading.set(false);
        // Backend je odmah vratio token, pa je korisnik prijavljen
        this.router.navigate(['/moji-oglasi']);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.handleError(error);
      },
    });
  }

  private handleError(error: HttpErrorResponse): void {
    if (error.status === 0) {
      this.errorMessage.set('Server nije dostupan. Proveri da li backend radi.');
      return;
    }

    // Backend uvek šalje telo oblika { status, message, fieldErrors }.
    // Pravi kod čitamo iz tela, jer backend neke greške šalje sa HTTP 400 iako je telo 409.
    const body = error.error;
    const code: number = body?.status ?? error.status;

    // 409: mejl već postoji. Greška pripada polju za mejl.
    if (code === 409) {
      this.setServerError('email', body?.message ?? 'Nalog sa ovim mejlom već postoji.');
      return;
    }

    // Greške po poljima (npr. { email: "Unesi ispravnu mejl adresu" })
    const fieldErrors: Record<string, string> = body?.fieldErrors ?? {};
    const fieldNames: string[] = Object.keys(fieldErrors);
    if (fieldNames.length > 0) {
      fieldNames.forEach((name) => this.setServerError(name, fieldErrors[name]));
      return;
    }

    if (body?.message) {
      this.errorMessage.set(body.message);
    } else {
      this.errorMessage.set('Registracija nije uspela. Pokušaj ponovo.');
    }
  }

  // Zakači poruku servera na polje. Nestaje čim korisnik izmeni to polje.
  private setServerError(fieldName: string, message: string): void {
    const control = this.registerForm.get(fieldName);

    if (control) {
      control.setErrors({ server: message });
      control.markAsTouched();
    } else {
      // Polje koje forma ne poznaje: poruka ne sme da se izgubi
      this.errorMessage.set(message);
    }
  }
}
