import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';

// Mesto gubitka: okvirna tačka + koliko metara okolo vlasnik može da pogreši
export interface MapLocation {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface RadiusOption {
  meters: number;
  label: string;
  hint: string;
}

// Ponuđeni radijusi. Backend dozvoljava 0-50000 m; ovo su vrednosti koje ljudi razumeju.
export const RADIUS_OPTIONS: RadiusOption[] = [
  { meters: 100, label: '100 m', hint: 'Baš ovde' },
  { meters: 300, label: '300 m', hint: 'U blizini' },
  { meters: 1000, label: '1 km', hint: 'U ovom delu grada' },
  { meters: 3000, label: '3 km', hint: 'Negde u široj okolini' },
];

export const DEFAULT_RADIUS_METERS = 300;

// Početni prikaz: cela Srbija
const SERBIA_CENTER: L.LatLngTuple = [44.1, 20.8];
const SERBIA_ZOOM = 7;
const PIN_ZOOM = 15;

// Baza čuva DECIMAL(9,6): više decimala nema smisla slati
const roundCoordinate = (value: number): number => Math.round(value * 1e6) / 1e6;

/**
 * Interaktivna mapa (Leaflet + OpenStreetMap) na kojoj vlasnik ostavlja OKVIRNI pin
 * i bira koliko je siguran u mesto (radijus). Ne zna ništa o formi: dobija trenutnu
 * lokaciju kroz [location] i javlja svaku promenu kroz (locationChange).
 *
 * Stilovi su bez enkapsulacije jer Leaflet sam pravi elemente (pin, krug) van Angular
 * šablona; sve klase počinju sa "lp-" da se ne sudaraju sa ostatkom aplikacije.
 */
@Component({
  selector: 'app-location-picker',
  templateUrl: './location-picker.html',
  styleUrl: './location-picker.css',
  encapsulation: ViewEncapsulation.None,
})
export class LocationPicker {
  location = input<MapLocation | null>(null);
  locationChange = output<MapLocation | null>();

  // Vlasniku treba radijus ("koliko sam siguran u mesto"), a nalazaču ne: on zna gde je našao.
  // Bez radijusa nema ni kruga na mapi, a lokacija se javlja sa radiusMeters = 0.
  showRadius = input<boolean>(true);

  // Dugmad "Moja trenutna lokacija" i "Pin na sredinu mape". "Ukloni pin" ostaje uvek kad pin postoji.
  showLocateTools = input<boolean>(true);

  // Natpis preko mape dok pin još nije postavljen
  prompt = input<string>('Klikni na mapu tamo gde misliš da si izgubio predmet');

  readonly radiusOptions = RADIUS_OPTIONS;

  // Kopija ulaza koju mapa menja; kad roditelj pošalje novu vrednost, ona pobeđuje
  current = linkedSignal<MapLocation | null>(() => this.location());
  message = signal<string>('');
  locating = signal<boolean>(false);

  private mapElement = viewChild.required<ElementRef<HTMLElement>>('map');
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private circle: L.Circle | null = null;
  private citySearch: AbortController | null = null;

  constructor() {
    // Mapa može da se napravi tek kad element postoji u stranici
    afterNextRender(() => this.initMap());

    // Pin i krug uvek prate trenutnu lokaciju (i kad je promeni roditelj, ne samo mapa)
    effect(() => this.draw(this.current()));

    inject(DestroyRef).onDestroy(() => {
      this.citySearch?.abort();
      this.map?.remove();
      this.map = null;
    });
  }

  // ---------- Akcije korisnika ----------

  // Klik na mapu ili prevlačenje pina
  placePin(latitude: number, longitude: number): void {
    const location: MapLocation = {
      latitude: roundCoordinate(latitude),
      longitude: roundCoordinate(longitude),
      radiusMeters: this.showRadius() ? (this.current()?.radiusMeters ?? DEFAULT_RADIUS_METERS) : 0,
    };
    this.update(location);
  }

  // Za tastaturu i za one koji ne žele da gađaju tačku: pin na sredinu onoga što se vidi
  pinAtCenter(): void {
    if (this.map === null) {
      return;
    }
    const center = this.map.getCenter();
    this.placePin(center.lat, center.lng);
  }

  setRadius(meters: number): void {
    const location = this.current();
    if (location === null) {
      return;
    }
    this.update({ ...location, radiusMeters: meters });

    // Pokaži ceo krug, da vlasnik vidi koliku oblast je obeležio
    if (this.map !== null && this.circle !== null) {
      this.map.fitBounds(this.circle.getBounds(), { maxZoom: 17, animate: false });
    }
  }

  clear(): void {
    this.update(null);
  }

  useMyLocation(): void {
    if (!('geolocation' in navigator)) {
      this.message.set('Tvoj browser ne može da odredi lokaciju. Klikni na mapu.');
      return;
    }

    this.locating.set(true);
    this.message.set('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.locating.set(false);
        this.placePin(position.coords.latitude, position.coords.longitude);
        this.map?.setView([position.coords.latitude, position.coords.longitude], PIN_ZOOM);
      },
      () => {
        this.locating.set(false);
        this.message.set('Lokacija nije dostupna. Obeleži mesto klikom na mapu.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  /**
   * Pomera mapu na grad koji je vlasnik upisao (ako pin još nije postavljen).
   * Koristi javni OpenStreetMap pretraživač; ako ne odgovori, mapa ostaje gde jeste.
   */
  centerOnCity(city: string): void {
    const name = city.trim();
    if (name.length < 2 || this.current() !== null || this.map === null) {
      return;
    }

    this.citySearch?.abort();
    this.citySearch = new AbortController();

    const url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=rs&q=' +
      encodeURIComponent(name);

    fetch(url, { signal: this.citySearch.signal, headers: { 'Accept-Language': 'sr-Latn' } })
      .then((response) => (response.ok ? response.json() : []))
      .then((results: { lat: string; lon: string }[]) => {
        if (results.length > 0 && this.map !== null && this.current() === null) {
          this.map.setView([Number(results[0].lat), Number(results[0].lon)], 13);
        }
      })
      .catch(() => undefined);
  }

  // ---------- Mapa ----------

  private initMap(): void {
    const location = this.current();
    const map = L.map(this.mapElement().nativeElement, {
      center: location ? [location.latitude, location.longitude] : SERBIA_CENTER,
      zoom: location ? PIN_ZOOM : SERBIA_ZOOM,
      // Točkić miša ne sme da otima skrolovanje forme; uključuje se tek kad se klikne u mapu
      scrollWheelZoom: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      map.scrollWheelZoom.enable();
      this.placePin(event.latlng.lat, event.latlng.lng);
    });

    this.map = map;
    this.draw(this.current());
  }

  private update(location: MapLocation | null): void {
    this.current.set(location);
    this.message.set('');
    this.draw(location);
    this.locationChange.emit(location);
  }

  // Usklađuje pin i krug na mapi sa trenutnom lokacijom
  private draw(location: MapLocation | null): void {
    const map = this.map;
    if (map === null) {
      return;
    }

    if (location === null) {
      this.marker?.remove();
      this.circle?.remove();
      this.marker = null;
      this.circle = null;
      return;
    }

    const point: L.LatLngTuple = [location.latitude, location.longitude];

    if (this.marker === null) {
      this.marker = L.marker(point, {
        draggable: true,
        keyboard: true,
        title: 'Prevuci pin da ga pomeriš',
        icon: L.divIcon({
          className: 'lp-pin',
          html: '<span></span>',
          iconSize: [30, 40],
          iconAnchor: [15, 40],
        }),
      }).addTo(map);

      this.marker.on('dragend', () => {
        const position = this.marker!.getLatLng();
        this.placePin(position.lat, position.lng);
      });
    } else {
      this.marker.setLatLng(point);
    }

    // Bez radijusa nema kruga: samo pin
    if (!this.showRadius()) {
      this.circle?.remove();
      this.circle = null;
    } else if (this.circle === null) {
      this.circle = L.circle(point, {
        radius: location.radiusMeters,
        color: '#0f4c5c',
        weight: 2,
        fillColor: '#0f4c5c',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(map);
    } else {
      this.circle.setLatLng(point);
      this.circle.setRadius(location.radiusMeters);
    }
  }
}
