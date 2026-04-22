import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html',
  styleUrls: ['./reports.scss']
})
export class ReportsComponent implements OnInit {
  transactions: any[] = [];
  totalStoreValue: number = 0;
  ipcRenderer: any;

  constructor(private cdr: ChangeDetectorRef, private toastr: ToastrService) {
    if ((<any>window).require) {
      this.ipcRenderer = (<any>window).require('electron').ipcRenderer;
    }
  }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    if (this.ipcRenderer) {
      this.transactions = await this.ipcRenderer.invoke('get-transactions');
      this.totalStoreValue = this.transactions.reduce((acc, tx) => acc + (tx.total_amount || 0), 0);
      this.cdr.detectChanges(); 
    }
  }

  // FIX: Triggers background PDF generation WITHOUT on-screen notifications
  async openPrintPreview() {
    if (this.ipcRenderer) {
      try {
        const result = await this.ipcRenderer.invoke('print-preview');
        
        if (result && result.error) {
          this.toastr.error("Failed to open PDF Preview: " + result.error);
        }
      } catch (e: any) {
        this.toastr.error("System error: " + e.message);
      }
    } else {
      window.print(); 
    }
  }

  async exportToExcel() {
    if (this.ipcRenderer) {
      try {
        const savedPath = localStorage.getItem('exportFilePath');
        const result = await this.ipcRenderer.invoke('export-data', savedPath);
        
        if (result.success) {
          localStorage.setItem('exportFilePath', result.path);
          this.toastr.success(`Excel file saved at: ${result.path}`, 'Export Successful');
        }
      } catch (err: any) {
        this.toastr.error('Export error: ' + err.message);
      }
    }
  }
}