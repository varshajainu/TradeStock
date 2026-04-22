import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { InventoryComponent } from './components/inventory/inventory';
import { TransactionsComponent } from './components/transactions/transactions';
import { ReportsComponent } from './components/reports/reports';
import { AccountsComponent } from './finances/finances';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'inventory', component: InventoryComponent },
  { path: 'transactions', component: TransactionsComponent },
  { path: 'finances', component: AccountsComponent },
  { path: 'reports', component: ReportsComponent },
  
  // THE FIX: Catch-all route that forces the dashboard to load on startup
  { path: '**', redirectTo: '/dashboard' }
];