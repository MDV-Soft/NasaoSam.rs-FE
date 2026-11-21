import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Landing } from './landing';

describe('Landing', () => {
  let component: Landing;
  let fixture: ComponentFixture<Landing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Landing],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Landing);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sends every "Našao sam" button to the finder form', () => {
    const page = fixture.nativeElement as HTMLElement;
    const links = Array.from(page.querySelectorAll<HTMLAnchorElement>('a[href="/nasao-sam"]'));

    // meni, uvod i kartica na dnu
    expect(links.map((link) => link.textContent?.trim().replace(/\s+/g, ' '))).toEqual([
      'Našao si?',
      'Našao sam',
      expect.stringContaining('Našao sam'),
    ]);
  });

  it('should show four steps', () => {
    const items = (fixture.nativeElement as HTMLElement).querySelectorAll('.step');
    expect(items.length).toBe(4);
  });
});
