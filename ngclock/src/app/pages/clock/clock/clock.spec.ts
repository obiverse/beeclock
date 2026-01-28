import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClockComponent as Clock, ClockComponent } from './clock';

describe('Clock', () => {
  let component: ClockComponent;
  let fixture: ComponentFixture<Clock>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Clock]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClockComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
