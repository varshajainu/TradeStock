# 📈 TradeStock - Desktop Inventory & Finance Manager

TradeStock is an offline-first, high-performance desktop application designed for shop owners and small businesses. Built with **Angular** and **Electron**, it provides a seamless interface to track daily transactions, manage store inventory, and maintain bank account balances without relying on a cloud server.

## ✨ Key Features

* **📦 Smart Inventory Management:** Track stock levels dynamically. Set custom "Low Stock" thresholds that trigger visual warnings on the dashboard.
* **💸 Transaction Logging:** Easily record Stock IN (purchases) and Stock OUT (sales). Automatically updates inventory quantities and bank account balances simultaneously.
* **🏦 Financial Tracking:** Manage multiple bank accounts or cash registers. Securely view balances and log internal account-to-account money transfers.
* **📄 Native PDF Reporting:** Generate flawless, print-ready PDF transaction reports with full pagination, utilizing the native system PDF viewer.
* **📊 Excel/CSV Export & Import:** Instantly export your entire transaction history to Excel, or bulk-import new stock items via CSV.
* **💾 Bulletproof Local Storage:** Powered by a lightweight **SQLite3** local database. Features prompt-based backup dialogs on application exit to prevent data loss during system crashes.

## 🛠️ Tech Stack

* **Frontend:** Angular, SCSS, HTML5
* **Desktop Wrapper:** Electron.js
* **Database:** SQLite3 (Local, Offline)
* **IPC Communication:** Electron IPC Main/Renderer bridging

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) and the Angular CLI installed on your machine.

```bash
npm install -g @angular/cli