import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-lost-report-list',
  imports: [],
  templateUrl: './lost-report-list.html',
  styleUrl: './lost-report-list.css',
})
export class LostReportList {
  private authService = inject(AuthService);
  private router = inject(Router);

  // Podaci o prijavljenom korisniku, sačuvani pri prijavi
  user: User | null = this.authService.getUser();

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
