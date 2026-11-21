import {
  DOWNSCALE_ABOVE_BYTES,
  MAX_PHOTO_BYTES,
  formatFileSize,
  photoSizeProblem,
  photoTypeProblem,
  preparePhoto,
} from './photo-file';

// Fajl zadate veličine, bez stvarnog sadržaja slike
const fileOf = (type: string, size: number, name = 'slika.jpg'): File =>
  new File([new Uint8Array(size)], name, { type });

describe('photoTypeProblem', () => {
  it('accepts JPEG and PNG', () => {
    expect(photoTypeProblem(fileOf('image/jpeg', 10))).toBeNull();
    expect(photoTypeProblem(fileOf('image/png', 10))).toBeNull();
  });

  it('rejects other formats (HEIC, GIF, PDF) and explains the iPhone setting', () => {
    expect(photoTypeProblem(fileOf('image/heic', 10))).toContain('JPEG i PNG');
    expect(photoTypeProblem(fileOf('image/heic', 10))).toContain('Najkompatibilnije');
    expect(photoTypeProblem(fileOf('image/gif', 10))).not.toBeNull();
    expect(photoTypeProblem(fileOf('application/pdf', 10))).not.toBeNull();
    expect(photoTypeProblem(fileOf('', 10))).not.toBeNull();
  });

  it('rejects an empty file', () => {
    expect(photoTypeProblem(fileOf('image/jpeg', 0))).toContain('prazan');
  });
});

describe('photoSizeProblem', () => {
  it('accepts up to exactly 5 MB and rejects more', () => {
    expect(photoSizeProblem(fileOf('image/jpeg', MAX_PHOTO_BYTES))).toBeNull();
    expect(photoSizeProblem(fileOf('image/jpeg', MAX_PHOTO_BYTES + 1))).toContain('5 MB');
  });
});

describe('formatFileSize', () => {
  it('shows KB below a megabyte and MB with a decimal comma above', () => {
    expect(formatFileSize(420 * 1024)).toBe('420 KB');
    expect(formatFileSize(10)).toBe('1 KB');
    expect(formatFileSize(3.2 * 1024 * 1024)).toBe('3,2 MB');
  });
});

describe('preparePhoto', () => {
  it('leaves a small photo untouched (same file, nothing is re-encoded)', async () => {
    const file = fileOf('image/jpeg', 1024 * 1024);
    expect(await preparePhoto(file)).toBe(file);
  });

  it('returns the original when the browser cannot downscale (no createImageBitmap)', async () => {
    // jsdom nema createImageBitmap: velika slika ostaje kakva jeste, a o njoj odlučuje provera veličine
    const big = fileOf('image/jpeg', DOWNSCALE_ABOVE_BYTES + 1);
    expect(await preparePhoto(big)).toBe(big);
  });

  it('returns the original when decoding fails', async () => {
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('oštećena slika')));
    try {
      const big = fileOf('image/jpeg', DOWNSCALE_ABOVE_BYTES + 1);
      expect(await preparePhoto(big)).toBe(big);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('downscales a big photo to a smaller JPEG', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 4000, height: 3000, close }));
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
      toBlob: (callback: (blob: Blob | null) => void) =>
        callback(new Blob([new Uint8Array(900_000)], { type: 'image/jpeg' })),
    };
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'canvas' ? (canvas as unknown as HTMLCanvasElement) : realCreate(tag),
    );

    try {
      const big = fileOf('image/png', DOWNSCALE_ABOVE_BYTES + 100, 'IMG_0042.png');
      const result = await preparePhoto(big);

      // Duža strana 4000 → 2000, odnos stranica ostaje isti
      expect(canvas.width).toBe(2000);
      expect(canvas.height).toBe(1500);
      expect(context.drawImage).toHaveBeenCalledOnce();
      expect(close).toHaveBeenCalled();
      expect(result).not.toBe(big);
      expect(result.type).toBe('image/jpeg');
      expect(result.name).toBe('IMG_0042.jpg');
      expect(result.size).toBe(900_000);
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it('keeps the original when downscaling did not make the file smaller', async () => {
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 100, height: 100, close: () => undefined }),
    );
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ fillStyle: '', fillRect: () => undefined, drawImage: () => undefined }),
      toBlob: (callback: (blob: Blob | null) => void) =>
        callback(new Blob([new Uint8Array(DOWNSCALE_ABOVE_BYTES + 5_000)], { type: 'image/jpeg' })),
    };
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'canvas' ? (canvas as unknown as HTMLCanvasElement) : realCreate(tag),
    );

    try {
      const big = fileOf('image/jpeg', DOWNSCALE_ABOVE_BYTES + 1);
      expect(await preparePhoto(big)).toBe(big);
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
