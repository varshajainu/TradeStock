import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './finances.html',
  styleUrls: ['./finances.scss']
})
export class AccountsComponent implements OnInit {
  ipcRenderer: any;
  accounts: any[] = [];
  transfers: any[] = [];
  sortOption: string = 'newest';
  
  unlockedAccounts: { [key: number]: boolean } = {};
  showPasswordModal: boolean = false;
  enteredPassword: string = '';
  targetAccountId: number | null = null;

  showAccountModal: boolean = false;
  accountModalAction: 'edit' | 'delete' = 'edit';
  accountSearch: string = '';
  filteredAccounts: any[] = [];

  newAccount = { bankName: '', accountNumber: '', holderName: '', initialBalance: 0 };
  newTransfer = { fromAccount: '', toAccount: '', amount: 0 };

  isEditingAccount: boolean = false;
  editingAccountId: number | null = null;
  
  showConfirmModal: boolean = false;
  accToDelete: number | null = null;

  // NEW VARIABLES FOR ADD / WITHDRAW MONEY
  showAdjustModal: boolean = false;
  adjustType: 'ADD' | 'WITHDRAW' = 'ADD';
  adjustForm = { accountId: '', amount: 0 };

  constructor(private toastr: ToastrService, private cdr: ChangeDetectorRef) {
    if ((<any>window).require) {
      this.ipcRenderer = (<any>window).require('electron').ipcRenderer;
    }
  }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    if (this.ipcRenderer) {
      this.accounts = await this.ipcRenderer.invoke('get-accounts') || [];
      this.transfers = await this.ipcRenderer.invoke('get-transfers') || [];
      this.sortTransfers();
      this.cdr.detectChanges();
    }
  }

  requestViewBalance(id: number) {
    this.targetAccountId = id;
    this.enteredPassword = '';
    this.showPasswordModal = true;
  }

  async verifyPassword() {
    const isValid = await this.ipcRenderer.invoke('verify-password', this.enteredPassword);
    if (isValid && this.targetAccountId !== null) {
      this.unlockedAccounts[this.targetAccountId] = true;
      this.showPasswordModal = false;
      this.toastr.success('Balance Revealed');
      this.cdr.detectChanges(); 
    } else {
      this.toastr.error('Incorrect Password');
    }
  }

  hideBalance(id: number) {
    this.unlockedAccounts[id] = false;
  }

  async saveAccount() {
    if(!this.newAccount.bankName || !this.newAccount.holderName || !this.newAccount.accountNumber) {
      this.toastr.warning('Please enter Bank Name, Account Number, and Holder Name.');
      return;
    }

    if (this.isEditingAccount) {
      const payload = { id: this.editingAccountId, ...this.newAccount };
      await this.ipcRenderer.invoke('update-account', payload);
      this.toastr.success('Account updated!');
    } else {
      await this.ipcRenderer.invoke('add-account', this.newAccount);
      this.toastr.success('Account added!');
    }
    this.cancelEditAccount();
    this.loadData();
  }

  cancelEditAccount() {
    this.isEditingAccount = false;
    this.editingAccountId = null;
    this.newAccount = { bankName: '', accountNumber: '', holderName: '', initialBalance: 0 };
  }

  openAccountModal(action: 'edit' | 'delete') {
    this.accountModalAction = action;
    this.accountSearch = '';
    this.filteredAccounts = [...this.accounts];
    this.showAccountModal = true;
  }

  closeAccountModal() {
    this.showAccountModal = false;
  }

  filterAccountModal() {
    const term = this.accountSearch.toLowerCase().trim();
    if (!term) {
      this.filteredAccounts = [...this.accounts];
      return;
    }
    this.filteredAccounts = this.accounts.filter(acc => 
      acc.bankName.toLowerCase().includes(term) || 
      acc.holderName.toLowerCase().includes(term)
    );
  }

  handleAccountSelect(acc: any) {
    this.closeAccountModal();
    if (this.accountModalAction === 'delete') {
      this.accToDelete = acc.id;
      this.showConfirmModal = true;
    } else {
      this.isEditingAccount = true;
      this.editingAccountId = acc.id;
      this.newAccount = { 
        bankName: acc.bankName, accountNumber: acc.accountNumber,
        holderName: acc.holderName, initialBalance: acc.balance 
      };
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async executeDelete() {
    if (this.accToDelete !== null) {
      await this.ipcRenderer.invoke('delete-account', this.accToDelete);
      this.toastr.success('Account deleted.');
      this.showConfirmModal = false;
      this.accToDelete = null;
      this.loadData();
    }
  }

  // --- NEW: SINGLE ACCOUNT ADJUSTMENTS (ADD/WITHDRAW) ---
  openAddMoneyModal() {
    this.adjustType = 'ADD';
    this.adjustForm = { accountId: '', amount: 0 };
    this.showAdjustModal = true;
  }

  openWithdrawModal() {
    this.adjustType = 'WITHDRAW';
    this.adjustForm = { accountId: '', amount: 0 };
    this.showAdjustModal = true;
  }

  closeAdjustModal() {
    this.showAdjustModal = false;
  }

  async executeAdjustBalance() {
    if (!this.adjustForm.accountId || this.adjustForm.amount <= 0) {
      this.toastr.warning('Please select an account and enter a valid amount.');
      return;
    }

    try {
      await this.ipcRenderer.invoke('adjust-account-balance', {
        accountId: this.adjustForm.accountId,
        amount: this.adjustForm.amount,
        type: this.adjustType
      });
      
      this.toastr.success(this.adjustType === 'ADD' ? 'Money successfully added!' : 'Money successfully withdrawn!');
      this.closeAdjustModal();
      this.loadData();
    } catch(err: any) {
      this.toastr.error(err.message);
    }
  }

  // --- INTERNAL ACCOUNT-TO-ACCOUNT TRANSFERS ---
  async recordTransfer() {
    if (!this.newTransfer.fromAccount || !this.newTransfer.toAccount || this.newTransfer.amount <= 0) {
      this.toastr.warning('Select both accounts and enter a valid amount.');
      return;
    }
    if (this.newTransfer.fromAccount === this.newTransfer.toAccount) {
      this.toastr.warning('Cannot transfer money to the same account.');
      return;
    }

    const senderAcc = this.accounts.find(acc => acc.id == this.newTransfer.fromAccount);
    if (senderAcc && senderAcc.balance < this.newTransfer.amount) {
      this.toastr.error(`Insufficient Funds! You only have ₹${senderAcc.balance} in this account.`);
      return; 
    }

    try {
      await this.ipcRenderer.invoke('record-transfer', this.newTransfer);
      this.toastr.success('Transfer recorded successfully!');
      this.newTransfer = { fromAccount: '', toAccount: '', amount: 0 };
      this.loadData();
    } catch (err: any) {
      this.toastr.error('Transfer failed: ' + err.message);
    }
  }

  sortTransfers() {
    if(this.sortOption === 'newest') {
      this.transfers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      this.transfers.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
  }
}