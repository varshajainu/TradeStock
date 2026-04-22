import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { DatabaseService } from '../../services/database.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule], 
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'] 
})
export class DashboardComponent implements OnInit {
  ipcRenderer: any;
  stockItems: any[] = []; 

  currentUser: string = 'Devaraja Reddy'; 
  isEditingName: boolean = false;
  tempName: string = '';

  constructor(
    private dbService: DatabaseService, 
    private cdr: ChangeDetectorRef, 
    private toastr: ToastrService
  ) {
    if ((<any>window).require) {
      this.ipcRenderer = (<any>window).require('electron').ipcRenderer;
    }
  }

  ngOnInit() {
    const savedName = localStorage.getItem('activeUserName');
    if (savedName) {
      this.currentUser = savedName;
    } else {
      localStorage.setItem('activeUserName', this.currentUser);
    }
    this.loadData();
  }

  editUser() {
    this.isEditingName = true;
    this.tempName = this.currentUser;
  }

  saveUser() {
    if (this.tempName.trim() !== '') {
      this.currentUser = this.tempName.trim();
      localStorage.setItem('activeUserName', this.currentUser);
    }
    this.isEditingName = false;
  }

  cancelEdit() {
    this.isEditingName = false;
  }

  async loadData() {
    try {
      this.stockItems = await this.dbService.getInventory();
      this.cdr.detectChanges();
    } catch (error) {
      this.toastr.error('Failed to load dashboard data', 'Error');
    }
  }
}