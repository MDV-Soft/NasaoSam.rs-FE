import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrecisionMeter } from './precision-meter';
import { Suggestion } from '../../../core/utils/completeness-score';

describe('PrecisionMeter', () => {
  let fixture: ComponentFixture<PrecisionMeter>;
  const page = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const render = async (score: number, suggestions: Suggestion[] = []) => {
    fixture.componentRef.setInput('score', score);
    fixture.componentRef.setInput('suggestions', suggestions);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PrecisionMeter] }).compileComponents();
    fixture = TestBed.createComponent(PrecisionMeter);
  });

  it('shows the score, the level and fills the bar', async () => {
    await render(66);

    expect(page().querySelector('.score')?.textContent).toBe('66');
    expect(page().textContent).toContain('Solidno');
    expect(page().querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('66');
    expect((page().querySelector('.fill') as HTMLElement).style.width).toBe('66%');
  });

  it('changes the color tone with the level', async () => {
    await render(10);
    expect(page().querySelector('aside')?.classList).toContain('tone-low');

    await render(95);
    expect(page().querySelector('aside')?.classList).toContain('tone-great');
    expect(page().querySelector('aside')?.classList).toContain('meter');
  });

  it('shows at most four suggestions, with the item number and the gain', async () => {
    const list: Suggestion[] = [
      { key: 'items.0.distinctiveMarks', itemIndex: 0, label: 'navedi posebne znake', gain: 14 },
      { key: 'coordinates', itemIndex: null, label: 'obeleži mesto na mapi', gain: 10 },
      { key: 'details', itemIndex: null, label: 'napiši detaljan opis', gain: 10 },
      { key: 'placeDescription', itemIndex: null, label: 'opiši mesto', gain: 10 },
      { key: 'items.0.material', itemIndex: 0, label: 'upiši materijal', gain: 7 },
    ];
    await render(14, list);

    const items = page().querySelectorAll('.tips li');
    expect(items.length).toBe(4);
    expect(items[0].textContent).toContain('Predmet 1: navedi posebne znake');
    expect(items[0].textContent).toContain('+14');
    expect(items[1].textContent).not.toContain('Predmet');
  });

  it('says everything is filled when there is nothing left to suggest', async () => {
    await render(100);
    expect(page().textContent).toContain('Popunio si sve što se boduje');
  });
});
