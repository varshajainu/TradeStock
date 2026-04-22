import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import packageJson from '../../package.json';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class AppComponent implements OnInit {
  title = 'tradestock';
  public appVersion: string = packageJson.version;
  ipcRenderer: any;
  showCloseModal: boolean = false;

  constructor(private cdr: ChangeDetectorRef) {
    if ((<any>window).require) {
      this.ipcRenderer = (<any>window).require('electron').ipcRenderer;
    }
  }

  ngOnInit() {
    if (this.ipcRenderer) {
      this.ipcRenderer.on('request-close-app', () => {
        this.showCloseModal = true;
        this.cdr.detectChanges();
      });
    }
  }

  // --- FIX: Native Electron Reload instead of Browser Reload ---
  globalRefresh() {
    if (this.ipcRenderer) {
      this.ipcRenderer.send('app-reload');
    }
  }

  cancelClose() {
    this.showCloseModal = false;
  }

  closeWithoutBackup() {
    this.ipcRenderer.send('confirm-close-app');
  }

  async backupAndClose() {
    await this.ipcRenderer.invoke('trigger-backup-and-close');
  }
}