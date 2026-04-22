import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountsComponent } from './finances';

describe('Finances', () => {
  let component: AccountsComponent;
  let fixture: ComponentFixture<AccountsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
