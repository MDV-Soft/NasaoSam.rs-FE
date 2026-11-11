import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LostReportList } from './lost-report-list';

describe('LostReportList', () => {
  let component: LostReportList;
  let fixture: ComponentFixture<LostReportList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LostReportList],
    }).compileComponents();

    fixture = TestBed.createComponent(LostReportList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
