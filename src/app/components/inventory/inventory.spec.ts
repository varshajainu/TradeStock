import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InventoryComponent } from './inventory';
import { DatabaseService } from '../../services/database.service';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

// 1. Create a Mock Service
class MockDatabaseService {
  async getInventory() {
    return [
      { id: 1, name: 'Dairy Pellets', category: 'Formulated Feeds', lowStockThreshold: 5 },
      { id: 2, name: 'Calf Starter', category: 'Young Stock', lowStockThreshold: 2 } 
    ];
  }
}

// Mocking Toastr and ActivatedRoute so the tests don't crash
class MockToastrService {
  success() {}
  error() {}
  warning() {}
}

describe('InventoryComponent', () => {
  let component: InventoryComponent;
  let fixture: ComponentFixture<InventoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventoryComponent], // If standalone
      providers: [
        { provide: DatabaseService, useClass: MockDatabaseService },
        { provide: ToastrService, useClass: MockToastrService },
        { 
          provide: ActivatedRoute, 
          useValue: { queryParams: of({}) } // Mocking the router params
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // triggers ngOnInit
  });

  it('should create and load inventory on init', async () => {
    expect(component).toBeTruthy();
    await fixture.whenStable(); // wait for async loadInventory
    expect(component.stockItems.length).toBe(2);
    expect(component.filteredItems.length).toBe(2);
  });

  it('should filter stock items based on search term', async () => {
    await fixture.whenStable();
    component.searchTerm = 'dairy';
    component.applyFiltersAndSort(); 
    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].name).toBe('Dairy Pellets');
  });

  it('should sort stock items by name (Z-A)', async () => {
    await fixture.whenStable();
    component.sortOption = 'name-desc'; 
    component.applyFiltersAndSort();  
    expect(component.filteredItems[0].name).toBe('Dairy Pellets'); // D comes before C in Z-A
  });

  // --- NEW LOGICAL VALIDATION TESTS ---

  it('should reject inputs that are too short', () => {
    const result = component.validateInput('A');
    expect(result.isValid).toBeFalse();
    expect(result.errorMessage).toBe('Must be at least 3 characters long.');
  });

  it('should reject inputs that contain no letters', () => {
    const resultNum = component.validateInput('12345');
    const resultSymbols = component.validateInput('!!!');
    
    expect(resultNum.isValid).toBeFalse();
    expect(resultNum.errorMessage).toBe('Must contain at least one alphabetical letter.');
    
    expect(resultSymbols.isValid).toBeFalse();
    expect(resultSymbols.errorMessage).toBe('Must contain at least one alphabetical letter.');
  });

  it('should reject inputs with invalid special characters', () => {
    const result = component.validateInput('Super Feed @#$');
    expect(result.isValid).toBeFalse();
    expect(result.errorMessage).toBe('Contains invalid special characters. (e.g., @, #, $, % are not allowed)');
  });

  it('should accept logically structured inputs (letters, numbers, safe punctuation)', () => {
    // This simulates exactly what your uncle might type!
    const result = component.validateInput('Premium Dairy Mash - (50kg. Bag)');
    expect(result.isValid).toBeTrue();
    expect(result.errorMessage).toBe('');
  });

  it('should block the user from saving a duplicate item name', async () => {
    await fixture.whenStable(); 
    
    // Simulate that "Dairy Pellets" is already in the database
    component.stockItems = [
      { id: 1, name: 'Dairy Pellets', category: 'Formulated Feeds', lowStockThreshold: 5 }
    ];

    // Simulate the user trying to type it again (even with weird capitalization)
    component.newItem = { id: null, name: 'DAIRY pellets', category: 'Formulated Feeds', lowStockThreshold: 5 };
    component.isEditing = false;

    // We use a spy to check if the toastr warning gets called
    const toastrSpy = spyOn((component as any).toastr, 'warning');

    await component.saveItem();

    // The component should have caught the duplicate and fired the warning!
    expect(toastrSpy).toHaveBeenCalledWith(
      `"DAIRY pellets" is already in your catalog! Use the Transactions tab to add more stock.`,
      'Duplicate Item Blocked'
    );
  });
  
});