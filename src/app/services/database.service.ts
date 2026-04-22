import { Injectable, NgZone } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private ipcRenderer: any;

  constructor(private zone: NgZone) {
    // Safely check if 'window' exists before trying to use Electron
    if (typeof window !== 'undefined' && (window as any).require) {
      this.ipcRenderer = (window as any).require('electron').ipcRenderer;
    } else {
      console.warn('App not running inside Electron or currently prerendering.');
    }
  }

  async getInventory(): Promise<any[]> {
    if (!this.ipcRenderer) return [];
    return this.ipcRenderer.invoke('get-inventory');
  }

  async addItem(item: any): Promise<any> {
    if (!this.ipcRenderer) return;
    return this.ipcRenderer.invoke('add-item', item);
  }

  // 👇 ADDED: The connection to your Electron Update handler
  async updateItem(item: any): Promise<any> {
    if (!this.ipcRenderer) return;
    return this.ipcRenderer.invoke('update-item', item);
  }

  // 👇 ADDED: The connection to your Electron Delete handler
  async deleteItem(id: number): Promise<any> {
    if (!this.ipcRenderer) return;
    return this.ipcRenderer.invoke('delete-item', id);
  }

  async addTransaction(tx: any): Promise<any> {
    if (!this.ipcRenderer) return;
    return this.ipcRenderer.invoke('add-transaction', tx);
  }

  async getTransactions(): Promise<any[]> {
    if (!this.ipcRenderer) return [];
    return this.ipcRenderer.invoke('get-transactions');
  }
}