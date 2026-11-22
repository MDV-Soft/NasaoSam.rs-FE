import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FinderShell } from './finder-shell';

@Component({
  imports: [FinderShell],
  template: '<app-finder-shell><p class="inside">Sadržaj stranice</p></app-finder-shell>',
})
class Host {}

describe('FinderShell', () => {
  let fixture: ComponentFixture<Host>;
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
  });

  it('puts the content of the page into the main column', () => {
    expect(page.querySelector('main .inside')?.textContent).toBe('Sadržaj stranice');
  });

  it('has the name of the site and a way back to the home page', () => {
    expect(page.querySelector('.brand')?.textContent?.trim()).toBe('NasaoSam');
    expect(page.querySelector('.brand')?.getAttribute('href')).toBe('/');
    expect(page.querySelector('.home-link')?.getAttribute('href')).toBe('/');
  });
});
