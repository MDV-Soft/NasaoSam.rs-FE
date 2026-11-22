import { Component, computed, input, linkedSignal, output } from '@angular/core';
import {
  DayChoice,
  MINUTE_STEP,
  MomentParts,
  addDays,
  describeMoment,
  earlierDayOptions,
  formatLocalDate,
  partsFromValue,
  valueFromParts,
} from '../../../core/utils/moment';

interface DayButton {
  id: DayChoice;
  label: string;
}

/**
 * Izbor datuma i vremena bez ugrađenog "datetime-local" polja, čiji izgled i redosled dana i
 * meseca zavise od browsera i sistema. Ovde je uvek isto:
 *
 *   [ Danas ] [ Juče ] [ Ranije ]      (Ranije otvara spisak dana: "Petak, 14. novembar")
 *   Sat [ 14 ]  :  Minuti [ 45 ]
 *   Danas, 22. novembar 2026. u 14:45  (rečenica koja potvrđuje izbor)
 *
 * Nema kucanja, pa se ne može upisati nepostojeći datum, a nude se samo dani do zadatog limita.
 * Vrednost je oblika "GGGG-MM-DDTHH:mm" (lokalno vreme). Provera "nije u budućnosti" nije ovde
 * nego u validatoru forme, koja zna pravila backenda.
 */
@Component({
  selector: 'app-moment-picker',
  templateUrl: './moment-picker.html',
  styleUrl: './moment-picker.css',
})
export class MomentPicker {
  // Trenutna vrednost; prazna znači "sada"
  value = input<string>('');
  // Koliko dana unazad se nudi (backend ne prima nalaz stariji od 30 dana)
  maxDaysBack = input<number>(30);
  valueChange = output<string>();

  readonly hours: number[] = Array.from({ length: 24 }, (_, hour) => hour);
  readonly minutes: number[] = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);

  // Delovi koji se prikazuju; kad roditelj pošalje novu vrednost, ona pobeđuje
  parts = linkedSignal<MomentParts>(() => partsFromValue(this.value(), this.now()));

  earlierDays = computed(() => earlierDayOptions(this.now(), this.maxDaysBack()));
  summary = computed(() => describeMoment(valueFromParts(this.parts()), this.now()));

  dayButtons = computed<DayButton[]>(() => {
    const buttons: DayButton[] = [
      { id: 'today', label: 'Danas' },
      { id: 'yesterday', label: 'Juče' },
    ];
    if (this.earlierDays().length > 0) {
      buttons.push({ id: 'earlier', label: 'Ranije' });
    }
    return buttons;
  });

  // Poslednji datum izabran pod "Ranije", da povratak na to dugme ne zaboravi izbor
  private lastEarlierDate: string | null = null;

  pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  chooseDay(day: DayChoice): void {
    const now = this.now();
    let date: string;

    if (day === 'today') {
      date = formatLocalDate(now);
    } else if (day === 'yesterday') {
      date = formatLocalDate(addDays(now, -1));
    } else {
      date = this.lastEarlierDate ?? this.earlierDays()[0].value;
      this.lastEarlierDate = date;
    }
    this.update({ ...this.parts(), day, date });
  }

  chooseEarlierDate(date: string): void {
    this.lastEarlierDate = date;
    this.update({ ...this.parts(), day: 'earlier', date });
  }

  chooseHour(hour: number): void {
    this.update({ ...this.parts(), hour });
  }

  chooseMinute(minute: number): void {
    this.update({ ...this.parts(), minute });
  }

  // Zasebna metoda da test može da zadrži fiksno vreme
  protected now(): Date {
    return new Date();
  }

  private update(parts: MomentParts): void {
    this.parts.set(parts);
    this.valueChange.emit(valueFromParts(parts));
  }
}
