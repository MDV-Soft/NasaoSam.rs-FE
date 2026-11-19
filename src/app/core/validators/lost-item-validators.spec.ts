import { FormControl, FormGroup } from '@angular/forms';
import { MIN_DESCRIPTION_LENGTH, lostItemValidator } from './lost-item-validators';

describe('lostItemValidator', () => {
  const validator = lostItemValidator();
  const LONG_DESCRIPTION = 'x'.repeat(MIN_DESCRIPTION_LENGTH);

  // Pravi grupu sa svim poljima predmeta; zadata polja prepisuju prazne vrednosti
  const makeItem = (values: Record<string, string> = {}) =>
    new FormGroup({
      category: new FormControl(values['category'] ?? ''),
      customCategory: new FormControl(values['customCategory'] ?? ''),
      documentType: new FormControl(values['documentType'] ?? ''),
      description: new FormControl(values['description'] ?? ''),
      lastName: new FormControl(values['lastName'] ?? ''),
      firstName: new FormControl(values['firstName'] ?? ''),
    });

  it('stays silent while no category is chosen (required handles that)', () => {
    expect(validator(makeItem())).toBeNull();
  });

  describe('ordinary items (wallet, keys, phone, bag)', () => {
    it.each(['WALLET', 'KEYS', 'PHONE', 'BAG'])('%s needs a description', (category) => {
      expect(validator(makeItem({ category }))).toEqual({
        descriptionTooShort: { required: 40, actual: 0 },
      });
    });

    it('accepts a description of exactly 40 characters', () => {
      expect(validator(makeItem({ category: 'WALLET', description: LONG_DESCRIPTION }))).toBeNull();
    });

    it('rejects 39 characters and reports how many there are', () => {
      const item = makeItem({ category: 'WALLET', description: 'x'.repeat(39) });

      expect(validator(item)).toEqual({ descriptionTooShort: { required: 40, actual: 39 } });
    });

    it('does not count spaces around the text', () => {
      const item = makeItem({ category: 'WALLET', description: '   ' + 'x'.repeat(39) + '   ' });

      expect(validator(item)).toEqual({ descriptionTooShort: { required: 40, actual: 39 } });
    });

    it('does not ask for a custom name or document data', () => {
      const item = makeItem({ category: 'KEYS', description: LONG_DESCRIPTION });

      expect(validator(item)).toBeNull();
    });
  });

  describe('"Other"', () => {
    it('needs a name of the item and a description', () => {
      expect(validator(makeItem({ category: 'OTHER' }))).toEqual({
        customCategoryRequired: true,
        descriptionTooShort: { required: 40, actual: 0 },
      });
    });

    it('rejects a name made only of spaces', () => {
      const item = makeItem({
        category: 'OTHER',
        customCategory: '   ',
        description: LONG_DESCRIPTION,
      });

      expect(validator(item)).toEqual({ customCategoryRequired: true });
    });

    it('accepts a name and a description', () => {
      const item = makeItem({
        category: 'OTHER',
        customCategory: 'Kišobran',
        description: LONG_DESCRIPTION,
      });

      expect(validator(item)).toBeNull();
    });
  });

  describe('documents', () => {
    it('need the document type, the last name and the first name', () => {
      expect(validator(makeItem({ category: 'DOCUMENT' }))).toEqual({
        documentTypeRequired: true,
        lastNameRequired: true,
        firstNameRequired: true,
      });
    });

    it('do NOT need a description', () => {
      const item = makeItem({
        category: 'DOCUMENT',
        documentType: 'ID_CARD',
        lastName: 'Petrović',
        firstName: 'Đorđe',
      });

      expect(validator(item)).toBeNull();
    });

    it('report only the missing name part', () => {
      const item = makeItem({
        category: 'DOCUMENT',
        documentType: 'ID_CARD',
        lastName: 'Petrović',
        firstName: '   ',
      });

      expect(validator(item)).toEqual({ firstNameRequired: true });
    });
  });

  describe('fields that do not apply to the chosen category', () => {
    it('are ignored: a leftover custom name does not matter for a wallet', () => {
      const item = makeItem({
        category: 'WALLET',
        customCategory: '',
        description: LONG_DESCRIPTION,
        documentType: '',
      });

      expect(validator(item)).toBeNull();
    });

    it('are ignored: a short leftover description does not matter for a document', () => {
      const item = makeItem({
        category: 'DOCUMENT',
        description: 'kratko',
        documentType: 'PASSPORT',
        lastName: 'Jović',
        firstName: 'Ana',
      });

      expect(validator(item)).toBeNull();
    });
  });
});
