import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Početna stranica: samo prikaz (tekst koraka je direktno u landing.html)
@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {}
