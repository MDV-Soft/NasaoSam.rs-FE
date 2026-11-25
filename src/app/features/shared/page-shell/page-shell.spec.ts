import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PageShell } from './page-shell';

@Component({
  imports: [PageShell],
  template: '<app-page-shell><p class="inside">Sadržaj stranice</p></app-page-shell>',
})
class Host {}

describe('PageShell', () => {
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

  it('goes back to the home page by default, with "← Početna"', () => {
    expect(page.querySelector('.home-link')?.textContent?.trim()).toBe('← Početna');
    expect(page.querySelector('.home-link')?.getAttribute('href')).toBe('/');
  });
});

@Component({
  imports: [PageShell],
  template:
    '<app-page-shell backLink="/moji-oglasi" backLabel="← Moji oglasi"><p>x</p></app-page-shell>',
})
class HostWithBackLink {}

describe('PageShell with another way back', () => {
  it('shows the link and the label that the page gives', async () => {
    await TestBed.configureTestingModule({
      imports: [HostWithBackLink],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostWithBackLink);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector('.home-link');

    expect(link?.textContent?.trim()).toBe('← Moji oglasi');
    expect(link?.getAttribute('href')).toBe('/moji-oglasi');
  });
});
