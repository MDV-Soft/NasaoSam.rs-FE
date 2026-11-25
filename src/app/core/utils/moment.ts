// Pomoćne funkcije za izbor trenutka (datum + sat + minut) u lokalnom vremenu, u obliku
// "GGGG-MM-DDTHH:mm" (isti oblik koji daje <input type="datetime-local">, pa ga
// `new Date(...)` čita kao lokalno vreme, a `toISOString()` pretvara u UTC).

// Minuti se biraju na po 5: tačnije od toga niko ne pamti kad je našao predmet
export const MINUTE_STEP = 5;

export type DayChoice = 'today' | 'yesterday' | 'earlier';

export interface MomentParts {
  day: DayChoice;
  // Pun datum izabranog dana, "GGGG-MM-DD"
  date: string;
  hour: number;
  minute: number;
}

export interface DayOption {
  value: string;
  label: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatLocalDateTime(date: Date): string {
  return `${formatLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Dan pomeren za zadati broj dana (lokalno vreme, bez problema sa prelaskom na letnje računanje)
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// "Sada", zaokruženo naniže na korak minuta (14:48 → 14:45), pa uvek nije u budućnosti
export function roundDownToStep(date: Date, step: number = MINUTE_STEP): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes() - (date.getMinutes() % step),
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const longDate = new Intl.DateTimeFormat('sr-Latn', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const weekdayDate = new Intl.DateTimeFormat('sr-Latn', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const shortWeekdayDate = new Intl.DateTimeFormat('sr-Latn', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

// "GGGG-MM-DD" kao lokalni datum (ne UTC, da dan ne bi "pobegao" oko ponoći)
export function parseLocalDate(text: string): Date {
  const [year, month, day] = text.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Rastavlja vrednost na delove za prikaz. Nevažeća ili prazna vrednost znači "sada".
 * Minuti se spuštaju na korak (14:48 → 14:45), jer se na ekranu biraju samo oni.
 */
export function partsFromValue(value: string, now: Date): MomentParts {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  const source = match ? value : formatLocalDateTime(roundDownToStep(now));
  const [date, time] = source.split('T');
  const [hour, minute] = time.split(':').map(Number);

  let day: DayChoice = 'earlier';
  if (date === formatLocalDate(now)) {
    day = 'today';
  } else if (date === formatLocalDate(addDays(now, -1))) {
    day = 'yesterday';
  }

  return { day, date, hour, minute: minute - (minute % MINUTE_STEP) };
}

export function valueFromParts(parts: MomentParts): string {
  return `${parts.date}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/**
 * Dani koji se nude pod "Ranije": od prekjuče unazad do zadatog broja dana,
 * npr. "Petak, 14. novembar". Danas i juče su posebna dugmad.
 */
export function earlierDayOptions(now: Date, maxDaysBack: number): DayOption[] {
  const options: DayOption[] = [];
  for (let back = 2; back <= maxDaysBack; back++) {
    const day = addDays(now, -back);
    options.push({
      value: formatLocalDate(day),
      label: capitalize(shortWeekdayDate.format(day)),
    });
  }
  return options;
}

/**
 * Rečenica koja potvrđuje izbor: "Danas, 22. novembar 2026. u 14:50",
 * "Juče, 21. novembar 2026. u 09:15", "Petak, 14. novembar 2026. u 18:00".
 */
export function describeMoment(value: string, now: Date): string {
  const parts = partsFromValue(value, now);
  const date = parseLocalDate(parts.date);
  const time = `${pad(parts.hour)}:${pad(parts.minute)}`;

  if (parts.day === 'today') {
    return `Danas, ${longDate.format(date)} u ${time}`;
  }
  if (parts.day === 'yesterday') {
    return `Juče, ${longDate.format(date)} u ${time}`;
  }
  return `${capitalize(weekdayDate.format(date))} u ${time}`;
}

/**
 * Dan bez sata, za rečenice: "danas", "juče" ili "25. novembar 2026.".
 * Prima i datum bez vremena ("GGGG-MM-DD"), npr. dan nalaza koji šalje backend.
 */
export function describeDay(dateText: string, now: Date): string {
  const date = parseLocalDate(dateText);

  if (dateText === formatLocalDate(now)) {
    return 'danas';
  }
  if (dateText === formatLocalDate(addDays(now, -1))) {
    return 'juče';
  }
  return longDate.format(date);
}
