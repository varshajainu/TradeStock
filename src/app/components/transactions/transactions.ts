import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { DatabaseService } from '../../services/database.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transactions.html',
  styleUrls: ['./transactions.scss']
})
export class TransactionsComponent implements OnInit {
  stockItems: any[] = [];
  transactions: any[] = [];
  accounts: any[] = [];
  ipcRenderer: any;

  newTx = {
    item_id: '', 
    type: 'OUT', 
    account_id: '', 
    priceMode: 'total', 
    unitPrice: 0, 
    quantity_changed: 1, 
    total_amount: 0
  };

  showModal: boolean = false;
  modalAction: 'edit' | 'delete' = 'edit';
  modalSearch: string = '';
  filteredTransactions: any[] = [];

  showConfirmModal: boolean = false;
  txToDelete: number | null = null;

  isEditing: boolean = false;
  editingTxId: number | null = null;

  constructor(
    private dbService: DatabaseService, 
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef // FIX: Added ChangeDetectorRef to force UI updates
  ) {
    if ((<any>window).require) {
      this.ipcRenderer = (<any>window).require('electron').ipcRenderer;
    }
  }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.stockItems = await this.dbService.getInventory();
    this.transactions = await this.ipcRenderer.invoke('get-transactions');
    this.accounts = await this.ipcRenderer.invoke('get-accounts') || [];
    
    // FIX: Tells Angular to immediately show the items and accounts in the dropdowns!
    this.cdr.detectChanges(); 
  }

  calculateTotal() {
    if (this.newTx.priceMode === 'unit') {
      this.newTx.total_amount = this.newTx.quantity_changed * this.newTx.unitPrice;
    }
  }

  async saveTransaction() {
    if (!this.newTx.item_id || this.newTx.quantity_changed <= 0) {
      this.toastr.warning('Please select an item and enter a valid quantity.');
      return;
    }
    
    if (this.newTx.total_amount <= 0) {
      this.toastr.error('Total amount must be greater than ₹0.');
      return;
    }

    if (!this.newTx.account_id) {
      this.toastr.error('Please select a Bank Account for the transaction.');
      return;
    }

    if (this.newTx.type === 'OUT') {
      const selectedItem = this.stockItems.find(i => i.id == this.newTx.item_id);
      if (selectedItem && this.newTx.quantity_changed > selectedItem.quantity) {
        this.toastr.error(`Insufficient Stock! You only have ${selectedItem.quantity} left in inventory.`);
        return;
      }
    }

    try {
      if (this.isEditing) {
        const payload = { id: this.editingTxId, ...this.newTx };
        await this.ipcRenderer.invoke('update-transaction', payload);
        this.toastr.success('Transaction updated!');
      } else {
        await this.ipcRenderer.invoke('add-transaction', this.newTx);
        this.toastr.success('Transaction saved!');
      }
      this.cancelEdit(); 
      this.loadData();
    } catch (err: any) {
      this.toastr.error('Failed to save transaction: ' + err.message);
    }
  }

  openModal(action: 'edit' | 'delete') {
    this.modalAction = action;
    this.modalSearch = '';
    this.filteredTransactions = [...this.transactions];
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  filterModal() {
    const term = this.modalSearch.toLowerCase().trim();
    if (!term) {
      this.filteredTransactions = [...this.transactions];
      return;
    }
    this.filteredTransactions = this.transactions.filter(tx => 
      (tx.item_name && tx.item_name.toLowerCase().includes(term)) || 
      tx.id.toString().includes(term)
    );
  }

  handleModalSelect(tx: any) {
    this.closeModal();
    if (this.modalAction === 'delete') {
      this.txToDelete = tx.id;
      this.showConfirmModal = true;
    } else {
      this.isEditing = true;
      this.editingTxId = tx.id;
      this.newTx = {
        item_id: tx.item_id, 
        type: tx.type, 
        account_id: tx.account_id || '',
        priceMode: 'total', 
        unitPrice: 0, 
        quantity_changed: tx.quantity_changed, 
        total_amount: tx.total_amount
      };
      this.toastr.info(`Editing Transaction #${tx.id}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async executeDelete() {
    if (this.txToDelete !== null) {
      await this.ipcRenderer.invoke('delete-transaction', this.txToDelete);
      this.toastr.success('Transaction Deleted');
      this.showConfirmModal = false;
      this.txToDelete = null;
      this.loadData();
    }
  }

  cancelEdit() {
    this.isEditing = false;
    this.editingTxId = null;
    this.newTx = { item_id: '', type: 'OUT', account_id: '', priceMode: 'total', unitPrice: 0, quantity_changed: 1, total_amount: 0 };
  }
}