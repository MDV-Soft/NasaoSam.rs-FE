import { FormControl, FormGroup } from '@angular/forms';
import { foundItemValidator } from './found-item-validators';

describe('foundItemValidator', () => {
  const validator = foundItemValidator();
  const makeGroup = (values: Record<string, string>) =>
    new FormGroup({
      category: new FormControl(''),
      customCategory: new FormControl(''),
      documentType: new FormControl(''),
      lastName: new FormControl(''),
      firstName: new FormControl(''),
      description: new FormControl(''),
      ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, new FormControl(v)])),
    });

  it('accepts an ordinary object without any description (unlike a lost report)', () => {
    expect(validator(makeGroup({ category: 'WALLET' }))).toBeNull();
    expect(validator(makeGroup({ category: 'KEYS', description: 'kratko' }))).toBeNull();
  });

  it('asks what the item is when the category is "Other"', () => {
    expect(validator(makeGroup({ category: 'OTHER' }))).toEqual({ customCategoryRequired: true });
    expect(validator(makeGroup({ category: 'OTHER', customCategory: 'Kišobran' }))).toBeNull();
  });

  it('asks for the document type and the name when the category is "Document"', () => {
    expect(validator(makeGroup({ category: 'DOCUMENT' }))).toEqual({
      documentTypeRequired: true,
      lastNameRequired: true,
      firstNameRequired: true,
    });
  });

  it('accepts a complete document', () => {
    expect(
      validator(
        makeGroup({
          category: 'DOCUMENT',
          documentType: 'ID_CARD',
          lastName: 'Petrović',
          firstName: 'Đorđe',
        }),
      ),
    ).toBeNull();
  });

  it('treats spaces as empty', () => {
    expect(validator(makeGroup({ category: 'OTHER', customCategory: '   ' }))).toEqual({
      customCategoryRequired: true,
    });
  });

  it('leaves an empty category to Validators.required', () => {
    expect(validator(makeGroup({}))).toBeNull();
  });
});
