import { ItemFormValue, buildItemRequest } from './lost-item-request';

describe('buildItemRequest', () => {
  const HASH_NAME = '63a91cca7f4cd75979029696f860e2b51331fd66ea748a278a1866a5073798ed';
  const HASH_NAME_DOB = '13d3022879cde05143657d2bd87929c817d6a06e443b32363175ea05678f120d';
  const DESCRIPTION = 'Crni kožni novčanik sa iskrzanim ćoškom i crvenim koncem na šavu.';

  // Prazna forma predmeta; zadata polja prepisuju prazne vrednosti
  const form = (values: Partial<ItemFormValue>): ItemFormValue => ({
    category: '',
    customCategory: '',
    documentType: '',
    color: '',
    brand: '',
    material: '',
    description: '',
    distinctiveMarks: '',
    lastName: '',
    firstName: '',
    dateOfBirth: '',
    ...values,
  });

  it('refuses an item without a category', async () => {
    await expect(buildItemRequest(form({}))).rejects.toThrow('Vrsta predmeta je obavezna');
  });

  describe('ordinary items', () => {
    it('sends only the filled-in fields', async () => {
      const item = await buildItemRequest(
        form({ category: 'WALLET', color: 'BLACK', description: DESCRIPTION }),
      );

      expect(item).toEqual({ category: 'WALLET', color: 'BLACK', description: DESCRIPTION });
    });

    it('sends all optional fields when they are filled in, trimmed', async () => {
      const item = await buildItemRequest(
        form({
          category: 'PHONE',
          color: 'SILVER',
          brand: '  Samsung ',
          material: ' metal ',
          description: ` ${DESCRIPTION} `,
          distinctiveMarks: ' naprsnuto staklo ',
        }),
      );

      expect(item).toEqual({
        category: 'PHONE',
        color: 'SILVER',
        brand: 'Samsung',
        material: 'metal',
        description: DESCRIPTION,
        distinctiveMarks: 'naprsnuto staklo',
      });
    });

    it('leaves out fields that contain only spaces', async () => {
      const item = await buildItemRequest(
        form({ category: 'KEYS', brand: '   ', description: DESCRIPTION }),
      );

      expect('brand' in item).toBe(false);
      expect('material' in item).toBe(false);
      expect('color' in item).toBe(false);
    });

    it('never sends document data, even if it was typed before the category changed', async () => {
      const item = await buildItemRequest(
        form({
          category: 'WALLET',
          description: DESCRIPTION,
          documentType: 'ID_CARD',
          lastName: 'Petrović',
          firstName: 'Đorđe',
          dateOfBirth: '1999-05-14',
          customCategory: 'Kišobran',
        }),
      );

      expect(item).toEqual({ category: 'WALLET', description: DESCRIPTION });
    });
  });

  describe('"Other"', () => {
    it('sends the custom name', async () => {
      const item = await buildItemRequest(
        form({ category: 'OTHER', customCategory: '  Kišobran ', description: DESCRIPTION }),
      );

      expect(item).toEqual({
        category: 'OTHER',
        customCategory: 'Kišobran',
        description: DESCRIPTION,
      });
    });
  });

  describe('documents', () => {
    it('sends the type and the two hashes (example from the backend README)', async () => {
      const item = await buildItemRequest(
        form({
          category: 'DOCUMENT',
          documentType: 'ID_CARD',
          lastName: 'Петровић',
          firstName: 'Ђорђе',
          dateOfBirth: '1999-05-14',
        }),
      );

      expect(item).toEqual({
        category: 'DOCUMENT',
        documentType: 'ID_CARD',
        nameHash: HASH_NAME,
        nameDobHash: HASH_NAME_DOB,
      });
    });

    it('never sends the real name or the date of birth', async () => {
      const item = await buildItemRequest(
        form({
          category: 'DOCUMENT',
          documentType: 'ID_CARD',
          lastName: 'Petrović',
          firstName: 'Đorđe',
          dateOfBirth: '1999-05-14',
        }),
      );

      const json = JSON.stringify(item);
      expect(json).not.toContain('Petrović');
      expect(json).not.toContain('Đorđe');
      expect(json).not.toContain('1999');
      expect('lastName' in item).toBe(false);
      expect('dateOfBirth' in item).toBe(false);
    });

    it('sends only the name hash when there is no date of birth', async () => {
      const item = await buildItemRequest(
        form({
          category: 'DOCUMENT',
          documentType: 'PASSPORT',
          lastName: 'Petrović',
          firstName: 'Đorđe',
        }),
      );

      expect(item.nameHash).toBe(HASH_NAME);
      expect('nameDobHash' in item).toBe(false);
    });

    it('ignores the date of birth for a bank card (backend rejects it)', async () => {
      const item = await buildItemRequest(
        form({
          category: 'DOCUMENT',
          documentType: 'BANK_CARD',
          lastName: 'Petrović',
          firstName: 'Đorđe',
          dateOfBirth: '1999-05-14',
        }),
      );

      expect(item.nameHash).toBe(HASH_NAME);
      expect('nameDobHash' in item).toBe(false);
    });

    it('gives the same hashes for cyrillic and latin spelling', async () => {
      const cyrillic = await buildItemRequest(
        form({
          category: 'DOCUMENT',
          documentType: 'ID_CARD',
          lastName: 'Петровић',
          firstName: 'Ђорђе',
          dateOfBirth: '1999-05-14',
        }),
      );
      const latin = await buildItemRequest(
        form({
          category: 'DOCUMENT',
          documentType: 'ID_CARD',
          lastName: 'petrovic',
          firstName: 'DJORDJE',
          dateOfBirth: '1999-05-14',
        }),
      );

      expect(latin).toEqual(cyrillic);
    });

    it('does not send description, color or brand for a document', async () => {
      const item = await buildItemRequest(
        form({
          category: 'DOCUMENT',
          documentType: 'ID_CARD',
          lastName: 'Petrović',
          firstName: 'Đorđe',
          color: 'BLACK',
          brand: 'nešto',
          description: DESCRIPTION,
        }),
      );

      expect('color' in item).toBe(false);
      expect('brand' in item).toBe(false);
      expect('description' in item).toBe(false);
    });

    it('sends no hashes when the name is missing', async () => {
      const item = await buildItemRequest(
        form({ category: 'DOCUMENT', documentType: 'ID_CARD', lastName: 'Petrović' }),
      );

      expect(item).toEqual({ category: 'DOCUMENT', documentType: 'ID_CARD' });
    });

    it('rejects an invalid date of birth', async () => {
      await expect(
        buildItemRequest(
          form({
            category: 'DOCUMENT',
            documentType: 'ID_CARD',
            lastName: 'Petrović',
            firstName: 'Đorđe',
            dateOfBirth: '14.05.1999',
          }),
        ),
      ).rejects.toThrow('GGGG-MM-DD');
    });
  });
});
