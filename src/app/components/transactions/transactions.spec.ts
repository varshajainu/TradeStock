import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionsComponent } from './transactions';
import { DatabaseService } from '../../services/database.service';

class MockDatabaseService {
  async getInventory() {
    return [{ id: 1, name: 'Test Item', quantity: 10, price: 100 }];
  }
  async addTransaction(tx: any) {
    return { success: true };
  }
}

describe('TransactionsComponent', () => {
  let component: TransactionsComponent;
  let fixture: ComponentFixture<TransactionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionsComponent],
      providers: [
        { provide: DatabaseService, useClass: MockDatabaseService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionsComponent);
    component = fixture.componentInstance;
    
    // Mock the window.alert so tests don't pause
    spyOn(window, 'alert');
    fixture.detectChanges();
  });

  it('should create and load items for dropdown', async () => {
    expect(component).toBeTruthy();
    await fixture.whenStable();
    expect(component.stockItems.length).toBe(1);
  });

  it('should block transaction if no item is selected', async () => {
    component.transaction.item_id = '';
    await component.recordTransaction();
    expect(window.alert).toHaveBeenCalledWith('Please select an item first!');
  });

  it('should record transaction and reset form fields', async () => {
    await fixture.whenStable();
    component.transaction.item_id = '1';
    component.transaction.quantity_changed = 5;
    component.transaction.total_amount = 500;

    await component.recordTransaction();
    
    expect(window.alert).toHaveBeenCalledWith('Transaction Recorded Successfully! Stock updated.');
    // Form should reset to defaults
    expect(component.transaction.quantity_changed).toBe(1);
    expect(component.transaction.total_amount).toBe(0);
  });
});