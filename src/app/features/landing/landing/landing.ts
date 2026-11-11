import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Step {
  number: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {
  steps: Step[] = [
    {
      number: '1',
      title: 'Prijavi',
      description: 'Vlasnik detaljno opiše izgubljenu stvar, a nalazač fotografiše ono što je pronašao.',
    },
    {
      number: '2',
      title: 'AI upoređuje',
      description: 'Sistem poredi fotografije i opis i pronalazi moguća poklapanja.',
    },
    {
      number: '3',
      title: 'Potvrda',
      description: 'Vlasnik dobija obaveštenje i potvrđuje da je stvar zaista njegova.',
    },
    {
      number: '4',
      title: 'Povratak',
      description: 'Dogovarate preuzimanje i stvar se vraća svom vlasniku.',
    },
  ];
}
