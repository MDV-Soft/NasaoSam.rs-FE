import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FoundItemsEditor } from './found-items-editor';
import { FinderReportItem } from '../../../core/models/found-report.model';
import { ItemOptions } from '../../../core/models/item-options.model';

const OPTIONS: ItemOptions = {
  categories: [
    { value: 'WALLET', label: 'Novčanik' },
    { value: 'DOCUMENT', label: 'Dokument' },
    { value: 'KEYS', label: 'Ključevi' },
    { value: 'OTHER', label: 'Ostalo' },
  ],
  documentTypes: [
    { value: 'ID_CARD', label: 'Lična karta' },
    { value: 'BANK_CARD', label: 'Platna kartica' },
  ],
  colors: [
    { value: 'BLACK', label: 'Crna' },
    { value: 'BLUE', label: 'Plava' },
  ],
};

const serverItem = (values: Partial<FinderReportItem>): FinderReportItem => ({
  category: 'KEYS',
  customCategory: null,
  documentType: null,
  color: null,
  brand: null,
  material: null,
  description: null,
  distinctiveMarks: null,
  ...values,
});

describe('FoundItemsEditor', () => {
  let component: FoundItemsEditor;
  let fixture: ComponentFixture<FoundItemsEditor>;

  const page = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => page().textContent ?? '';
  const settle = () => fixture.whenStable();

  const setup = async (initialItems: FinderReportItem[] = []) => {
    await TestBed.configureTestingModule({ imports: [FoundItemsEditor] }).compileComponents();
    fixture = TestBed.createComponent(FoundItemsEditor);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('initialItems', initialItems);
    await settle();
  };

  // Izbor ili upis u polje, kao što bi uradio korisnik
  const choose = async (id: string, value: string) => {
    const field = page().querySelector<HTMLSelectElement | HTMLInputElement>('#' + id)!;
    field.value = value;
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
    await settle();
  };

  it('starts with one empty item and the labels from the server', async () => {
    await setup();

    expect(component.itemGroups.length).toBe(1);
    const labels = Array.from(page().querySelectorAll('#category-0 option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(labels).toEqual(['Izaberi vrstu', 'Novčanik', 'Dokument', 'Ključevi', 'Ostalo']);
  });

  it('shows the items it was given (e.g. already saved on the server)', async () => {
    await setup([
      serverItem({
        category: 'WALLET',
        color: 'BLACK',
        brand: 'Guess',
        description: 'Crni, iskrzan',
      }),
      serverItem({ category: 'KEYS' }),
    ]);

    expect(component.itemGroups.length).toBe(2);
    expect(page().querySelector<HTMLSelectElement>('#category-0')?.value).toBe('WALLET');
    expect(page().querySelector<HTMLSelectElement>('#color-0')?.value).toBe('BLACK');
    expect(page().querySelector<HTMLInputElement>('#brand-0')?.value).toBe('Guess');
    expect(page().querySelector<HTMLTextAreaElement>('#description-0')?.value).toBe(
      'Crni, iskrzan',
    );
    expect(page().querySelector<HTMLSelectElement>('#category-1')?.value).toBe('KEYS');
  });

  it('asks to type the name of a document again (the server does not give it back)', async () => {
    await setup([serverItem({ category: 'DOCUMENT', documentType: 'ID_CARD' })]);

    expect(page().querySelector<HTMLSelectElement>('#documentType-0')?.value).toBe('ID_CARD');
    expect(page().querySelector<HTMLInputElement>('#lastName-0')?.value).toBe('');
    expect(text()).toContain('pa ga upiši ponovo');
  });

  it('does not say that for a document that is new', async () => {
    await setup();
    await choose('category-0', 'DOCUMENT');

    expect(text()).not.toContain('pa ga upiši ponovo');
  });

  it('shows the fields that belong to the chosen category', async () => {
    await setup();
    expect(page().querySelector('#description-0')).toBeNull();

    await choose('category-0', 'WALLET');
    expect(page().querySelector('#description-0')).not.toBeNull();
    expect(page().querySelector('#color-0')).not.toBeNull();
    expect(page().querySelector('#lastName-0')).toBeNull();

    await choose('category-0', 'OTHER');
    expect(page().querySelector('#customCategory-0')).not.toBeNull();

    await choose('category-0', 'DOCUMENT');
    expect(page().querySelector('#documentType-0')).not.toBeNull();
    expect(page().querySelector('#lastName-0')).not.toBeNull();
    expect(page().querySelector('#firstName-0')).not.toBeNull();
    expect(page().querySelector('#description-0')).toBeNull();
    expect(page().querySelector('#color-0')).toBeNull();
  });

  it('hides the date of birth for a bank card', async () => {
    await setup();
    await choose('category-0', 'DOCUMENT');
    await choose('documentType-0', 'ID_CARD');
    expect(page().querySelector('#dateOfBirth-0')).not.toBeNull();

    await choose('documentType-0', 'BANK_CARD');

    expect(page().querySelector('#dateOfBirth-0')).toBeNull();
  });

  it('adds items up to 10, and then the button is disabled', async () => {
    await setup();
    const addButton = (): HTMLButtonElement =>
      Array.from(page().querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Dodaj još jedan predmet'),
      ) as HTMLButtonElement;

    for (let i = 0; i < 12; i++) {
      addButton().click();
      await settle();
    }

    expect(component.itemGroups.length).toBe(10);
    expect(page().querySelectorAll('.item-card').length).toBe(10);
    expect(addButton().disabled).toBe(true);
  });

  it('removes an item but never the last one', async () => {
    await setup([serverItem({ category: 'WALLET' }), serverItem({ category: 'KEYS' })]);

    component.removeItem(0);
    expect(component.itemGroups.length).toBe(1);
    expect(component.itemGroups[0].controls.category.value).toBe('KEYS');

    component.removeItem(0);
    expect(component.itemGroups.length).toBe(1);
  });

  describe('validate()', () => {
    it('is false for an empty item and shows what is missing', async () => {
      await setup();

      expect(component.validate()).toBe(false);
      await settle();

      expect(text()).toContain('Izaberi vrstu predmeta.');
    });

    it('does not ask for a description (unlike a lost report)', async () => {
      await setup([serverItem({ category: 'WALLET' })]);

      expect(component.validate()).toBe(true);
    });

    it('asks what the item is for "Other"', async () => {
      await setup([serverItem({ category: 'OTHER' })]);

      expect(component.validate()).toBe(false);
      await settle();
      expect(text()).toContain('Upiši šta je predmet.');
    });

    it('asks for the type and the name of a document', async () => {
      await setup([serverItem({ category: 'DOCUMENT' })]);

      expect(component.validate()).toBe(false);
      await settle();
      expect(text()).toContain('Izaberi vrstu dokumenta.');
      expect(text()).toContain('Unesi prezime.');
      expect(text()).toContain('Unesi ime.');
    });

    it('checks every item, not only the first', async () => {
      await setup([serverItem({ category: 'WALLET' })]);
      component.addItem();

      expect(component.validate()).toBe(false);
      expect(component.itemGroups[0].valid).toBe(true);
      expect(component.itemGroups[1].valid).toBe(false);
    });
  });

  describe('buildRequests()', () => {
    it('builds what the backend expects and leaves out empty fields', async () => {
      await setup([
        serverItem({ category: 'WALLET', color: 'BLACK', brand: 'Guess' }),
        serverItem({ category: 'OTHER', customCategory: 'Kišobran' }),
      ]);

      expect(await component.buildRequests()).toEqual([
        { category: 'WALLET', color: 'BLACK', brand: 'Guess' },
        { category: 'OTHER', customCategory: 'Kišobran' },
      ]);
    });

    it('sends only the hash of the name of a document, never the name or the birth date', async () => {
      await setup();
      await choose('category-0', 'DOCUMENT');
      await choose('documentType-0', 'ID_CARD');
      await choose('lastName-0', 'Петровић');
      await choose('firstName-0', 'Ђорђе');
      await choose('dateOfBirth-0', '1999-05-14');

      const requests = await component.buildRequests();

      // Isti heševi kao u primeru iz README-a backenda ("petrovic|djordje|1999-05-14")
      expect(requests).toEqual([
        {
          category: 'DOCUMENT',
          documentType: 'ID_CARD',
          nameHash: '63a91cca7f4cd75979029696f860e2b51331fd66ea748a278a1866a5073798ed',
          nameDobHash: '13d3022879cde05143657d2bd87929c817d6a06e443b32363175ea05678f120d',
        },
      ]);
      const raw = JSON.stringify(requests);
      expect(raw).not.toContain('Петровић');
      expect(raw).not.toContain('1999-05-14');
    });
  });

  it('reset() replaces the list and always leaves at least one item', async () => {
    await setup([serverItem({ category: 'WALLET' }), serverItem({ category: 'KEYS' })]);

    component.reset([serverItem({ category: 'OTHER', customCategory: 'Kišobran' })]);
    expect(component.itemGroups.length).toBe(1);
    expect(component.itemGroups[0].controls.category.value).toBe('OTHER');

    component.reset([]);
    expect(component.itemGroups.length).toBe(1);
    expect(component.itemGroups[0].controls.category.value).toBe('');
  });
});
