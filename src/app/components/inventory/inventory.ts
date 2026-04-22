import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { DatabaseService } from '../../services/database.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute } from '@angular/router';

export interface Item {
  id: number;
  itemName: string;
  category: string;
  lowStockThreshold: number; 
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.html',
  styleUrls: ['./inventory.scss']
})
export class InventoryComponent implements OnInit {
  stockItems: any[] = [];
  filteredItems: any[] = [];
  searchTerm: string = '';
  sortOption: string = 'name-asc';
  ipcRenderer: any;

  // Variables for the manual add/edit form
  showAddForm: boolean = false;
  isEditing: boolean = false;
  
  newItem = { id: null as number | null, name: '', category: '', lowStockThreshold: 5 };

  // --- NEW MODAL VARIABLES ---
  showActionModal: boolean = false;
  modalActionType: 'edit' | 'delete' = 'edit';
  modalSearchTerm: string = '';
  modalFilteredItems: any[] = [];

  // Hybrid Validation List
  blockedWords: string[] = ['stupid', 'idiot', 'crap', 'dumb', 'fake', 'test', 'admin', 'john', 'doe', 'jane'];

  // Hybrid Validation Logic
  validateInput(text: string): { isValid: boolean; errorMessage: string } {
    if (!text || text.trim() === '') {
      return { isValid: false, errorMessage: 'Field cannot be empty.' };
    }

    const trimmedText = text.trim();

    if (trimmedText.length < 3) {
      return { isValid: false, errorMessage: 'Must be at least 3 characters long.' };
    }

    const hasLetter = /[a-zA-Z]/.test(trimmedText);
    if (!hasLetter) {
      return { isValid: false, errorMessage: 'Must contain at least one alphabetical letter.' };
    }

    const safeCharactersRegex = /^[a-zA-Z0-9\s\-\(\)\.,]+$/;
    if (!safeCharactersRegex.test(trimmedText)) {
      return { isValid: false, errorMessage: 'Contains invalid special characters. (e.g., @, #, $, % are not allowed)' };
    }

    const containsBlockedWord = this.blockedWords.some(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(trimmedText);
    });

    if (containsBlockedWord) {
      return { isValid: false, errorMessage: 'Contains restricted words or inappropriate language.' };
    }

    return { isValid: true, errorMessage: '' };
  }

  constructor(
    private dbService: DatabaseService, 
    private cdr: ChangeDetectorRef, 
    private toastr: ToastrService,
    private route: ActivatedRoute
  ) {
    if ((<any>window).require) {
      this.ipcRenderer = (<any>window).require('electron').ipcRenderer;
    }
  }

  ngOnInit() {
    this.loadInventory();
  }

  async loadInventory() {
    this.stockItems = await this.dbService.getInventory();
    this.applyFiltersAndSort(); 
  }

  getUniqueCategories(): string[] {
    const existingCats = this.stockItems.map(item => item.category).filter(Boolean);
    return [...new Set(existingCats)].sort();
  }

  applyFiltersAndSort() {
    this.filteredItems = this.stockItems.filter(item => {
      if (!item || !item.name) return false;
      return item.name.toLowerCase().includes(this.searchTerm.toLowerCase());
    });

    this.filteredItems.sort((a, b) => {
      if (this.sortOption === 'name-asc') return a.name.localeCompare(b.name);
      if (this.sortOption === 'name-desc') return b.name.localeCompare(a.name);
      return 0;
    });

    this.cdr.detectChanges();
  }

  // --- MODAL METHODS ---
  openActionModal(action: 'edit' | 'delete') {
    this.modalActionType = action;
    this.modalSearchTerm = '';
    this.modalFilteredItems = [...this.stockItems]; 
    this.showActionModal = true;
  }

  closeActionModal() {
    this.showActionModal = false;
  }

  filterModalItems() {
    const term = this.modalSearchTerm.toLowerCase().trim();
    if (!term) {
      this.modalFilteredItems = [...this.stockItems];
      return;
    }
    this.modalFilteredItems = this.stockItems.filter(item => 
      item.name.toLowerCase().includes(term) || 
      item.id.toString() === term 
    );
  }

  handleModalSelection(item: any) {
    this.closeActionModal();
    if (this.modalActionType === 'edit') {
      this.editItem(item);
    } else {
      this.deleteItem(item);
    }
  }

  // --- ADD / UPDATE LOGIC ---
  async saveItem() {
    const nameValidation = this.validateInput(this.newItem.name);
    if (!nameValidation.isValid) {
      this.toastr.error(nameValidation.errorMessage, 'Invalid Item Name');
      return; 
    }

    const categoryValidation = this.validateInput(this.newItem.category);
    if (!categoryValidation.isValid) {
      this.toastr.error(categoryValidation.errorMessage, 'Invalid Category');
      return; 
    }

    const isDuplicate = this.stockItems.some(item => {
      if (this.isEditing && item.id === this.newItem.id) {
        return false;
      }
      return item.name.toLowerCase().trim() === this.newItem.name.toLowerCase().trim();
    });

    if (isDuplicate) {
      this.toastr.warning(
        `"${this.newItem.name}" is already in your catalog! Use the Transactions tab to add more stock.`, 
        'Duplicate Item Blocked'
      );
      return; 
    }

    try {
      if (this.isEditing) {
        if (!window.confirm(`Do you want to edit "${this.newItem.name}"?`)) return;
        await this.ipcRenderer.invoke('update-item', this.newItem);
        this.toastr.success(`Item updated successfully!`, 'Success');
      } else {
        await this.ipcRenderer.invoke('add-item', this.newItem);
        this.toastr.success(`${this.newItem.name} added to inventory!`, 'Success');
      }
      
      this.resetForm();
      await this.loadInventory();
    } catch (error) {
      this.toastr.error('Failed to save item.', 'Error');
    }
  }
  
  editItem(item: any) {
    this.showAddForm = true;
    this.isEditing = true;
    this.newItem = { 
      id: item.id, 
      name: item.name, 
      category: item.category, 
      lowStockThreshold: item.lowStockThreshold || 5 
    };
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  }

  async deleteItem(item: any) {
    if (window.confirm(`Are you sure you want to delete "${item.name}"? This cannot be undone.`)) {
      try {
        await this.ipcRenderer.invoke('delete-item', item.id);
        this.toastr.success('Item deleted.', 'Deleted');
        await this.loadInventory();
      } catch (error) {
        this.toastr.error('Failed to delete item.', 'Error');
      }
    }
  }

  resetForm() {
    this.newItem = { id: null, name: '', category: '', lowStockThreshold: 5 };
    this.showAddForm = false;
    this.isEditing = false;
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const csvText = e.target.result;
        this.parseAndImportCSV(csvText);
        event.target.value = ''; 
      };
      reader.readAsText(file); 
    }
  }

  async parseAndImportCSV(csvText: string) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const dataRows = lines.slice(1); 
    
    const itemsToImport = dataRows.reduce((acc: any[], row) => {
      const columns = row.split(','); 
      const name = columns[0]?.trim();
      if (name) {
        acc.push({
          name: name,
          category: columns[1]?.trim(),
          lowStockThreshold: parseInt(columns[2]?.trim() || '5', 10) 
        });
      }
      return acc;
    }, []);

    if (this.ipcRenderer && itemsToImport.length > 0) {
      try {
        await this.ipcRenderer.invoke('import-csv', itemsToImport);
        this.toastr.success(`Imported ${itemsToImport.length} items.`, 'Import Complete');
        await this.loadInventory(); 
      } catch (error) {
        this.toastr.error('Error importing data.', 'Failed');
      }
    }
  }
}