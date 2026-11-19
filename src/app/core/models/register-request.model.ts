export interface RegisterRequest {
  email: string;
  password: string;
  // Nije obavezno: ako korisnik ništa ne upiše, polje se uopšte ne šalje
  displayName?: string;
  phone: string;
}
