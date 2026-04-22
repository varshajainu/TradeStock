import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportsComponent } from './reports';
import { DatabaseService } from '../../services/database.service';

class MockDatabaseService {
  async getInventory() {
    return [
      { id: 1, name: 'Item A', quantity: 10, price: 100 }, // Value: 1000
      { id: 2, name: 'Item B', quantity: 5, price: 50 }    // Value: 250
    ];
  }
  async getTransactions() {
    return [
      { id: 1, item_name: 'Item A', type: 'IN', quantity_changed: 10, total_amount: 1000, date: '2026-01-01' }
    ];
  }
}

describe('ReportsComponent', () => {
  let component: ReportsComponent;
  let fixture: ComponentFixture<ReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        { provide: DatabaseService, useClass: MockDatabaseService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and calculate total store value correctly', async () => {
    expect(component).toBeTruthy();
    await fixture.whenStable();
    
    // 1000 + 250 = 1250
    expect(component.totalStoreValue).toBe(1250);
    
    // THE FIX: Changed to match the 'transactions' variable in reports.ts
    expect(component.transactions.length).toBe(1);
  });

  .btn-print {
  background-color: #2b6cb0;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}

@media print {
  .btn-print, .icon-refresh-btn {
    display: none !important;
  }
  .reports-container {
    box-shadow: none;
    padding: 0;
  }
}
});

