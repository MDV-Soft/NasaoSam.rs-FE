// Isto kao na backendu (application.yml: max-file-size, FoundReportService.MAX_PHOTO_BYTES)
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Telefon često daje 6-10 MB. Veće od ovoga se pre slanja smanji, pa slanje je brže
// i ne puca na ograničenju od 5 MB. Backend ionako smanjuje sliku na 1600 piksela.
export const DOWNSCALE_ABOVE_BYTES = 4.5 * 1024 * 1024;
export const DOWNSCALE_MAX_SIDE = 2000;
const DOWNSCALE_QUALITY = 0.88;

const ALLOWED_TYPES: string[] = ['image/jpeg', 'image/png'];

// Poruka ako fajl nije slika koju backend prima; null ako je u redu
export function photoTypeProblem(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Dozvoljene su samo JPEG i PNG fotografije. Na iPhone-u u podešavanjima kamere izaberi „Najkompatibilnije”.';
  }
  if (file.size === 0) {
    return 'Fajl je prazan. Izaberi drugu fotografiju.';
  }
  return null;
}

// Poruka ako je fajl prevelik za backend; null ako je u redu
export function photoSizeProblem(file: File): string | null {
  if (file.size > MAX_PHOTO_BYTES) {
    return 'Fotografija je prevelika (najviše 5 MB). Probaj sa manjom.';
  }
  return null;
}

// "3,2 MB", "420 KB"
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
  }
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

/**
 * Priprema sliku za slanje: velika se smanji na najviše 2000 piksela po dužoj strani.
 * Ponovnim upisom nestaju i EXIF podaci, a okretanje po EXIF-u browser primeni pre toga.
 *
 * Nikad ne puca: ako browser ne može (nema podrške, oštećena slika), vraća originalni fajl,
 * pa o njemu odlučuje backend.
 */
export async function preparePhoto(file: File): Promise<File> {
  if (file.size <= DOWNSCALE_ABOVE_BYTES || typeof createImageBitmap !== 'function') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, DOWNSCALE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context === null) {
      return file;
    }
    // Providni PNG se stavlja na belu pozadinu (JPEG nema providnost)
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', DOWNSCALE_QUALITY),
    );
    // Ako smanjivanje nije pomoglo, ostaje original
    if (blob === null || blob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'fotografija';
    return new File([blob], baseName + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
