import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard'; 
import { DatabaseService } from '../../services/database.service';

class MockDatabaseService {
  async getInventory() {
    return [
      { id: 1, quantity: 10 },
      { id: 2, quantity: 3 }, // low stock
      { id: 3, quantity: 1 }  // low stock
    ];
  }
}

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: DatabaseService, useClass: MockDatabaseService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should calculate total items and low stock alerts correctly', async () => {
    expect(component).toBeTruthy();
    await fixture.whenStable();
    
    // THE FIX: Updated variable names to match dashboard.ts
    expect(component.totalUniqueItems).toBe(3); 
    expect(component.lowStockAlerts).toBe(2); 
  });
});