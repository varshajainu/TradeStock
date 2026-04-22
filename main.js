const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron'); 
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

let mainWindow;
let db;
let isForceClosing = false; 

function getIndexPath() {
  const browserPath = path.join(__dirname, 'dist', 'tradestock', 'browser', 'index.html');
  const rootPath = path.join(__dirname, 'dist', 'tradestock', 'index.html');
  if (fs.existsSync(browserPath)) return browserPath;
  if (fs.existsSync(rootPath)) return rootPath;
  return browserPath; 
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    icon: path.join(__dirname, 'src/assets/logo.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, 
    }
  });

  mainWindow.loadFile(getIndexPath(), {hash: 'dashboard'});
  mainWindow.setMenuBarVisibility(false);
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
    // CONSOLE TAB REMOVED HERE
  });

  mainWindow.on('close', (e) => {
    if (!isForceClosing) {
      e.preventDefault(); 
      mainWindow.webContents.send('request-close-app'); 
    }
  });
}

ipcMain.on('app-reload', () => {
  if (mainWindow) {
    const currentURL = mainWindow.webContents.getURL();
    let currentHash = 'dashboard'; 
    if (currentURL.includes('#')) {
      currentHash = currentURL.split('#')[1];
    }
    mainWindow.loadFile(getIndexPath(), { hash: currentHash });
  }
});

ipcMain.on('confirm-close-app', () => {
  isForceClosing = true;
  mainWindow.close();
});

ipcMain.handle('trigger-backup-and-close', async () => {
  const backupPathFile = path.join(app.getPath('userData'), '.backup_path.dat');
  let defaultPath = 'tradestock_backup.db';
  
  if (fs.existsSync(backupPathFile)) {
    defaultPath = fs.readFileSync(backupPathFile, 'utf8').trim();
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save TradeStock Backup',
    defaultPath: defaultPath,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }]
  });

  if (!result.canceled && result.filePath) {
    const dbPath = path.join(app.getPath('userData'), 'tradestock.db');
    fs.copyFileSync(dbPath, result.filePath);
    fs.writeFileSync(backupPathFile, result.filePath, 'utf8');
  }
  
  isForceClosing = true;
  mainWindow.close();
});

function initDB() {
  const dbPath = path.join(app.getPath('userData'), 'tradestock.db');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database opening error: ', err);
  });

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS stock_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      quantity INTEGER DEFAULT 0,
      price REAL DEFAULT 0.0,
      lowStockThreshold INTEGER DEFAULT 5
    )`);

    db.run(`ALTER TABLE stock_items ADD COLUMN lowStockThreshold INTEGER DEFAULT 5`, (err) => {});

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      account_id INTEGER,
      type TEXT NOT NULL, 
      quantity_changed INTEGER,
      total_amount REAL,
      date TEXT,
      paymentMethod TEXT DEFAULT 'Bank Transfer',
      FOREIGN KEY(item_id) REFERENCES stock_items(id),
      FOREIGN KEY(account_id) REFERENCES accounts(id)
    )`);

    db.run(`ALTER TABLE transactions ADD COLUMN paymentMethod TEXT DEFAULT 'Bank Transfer'`, (err) => {});
    db.run(`ALTER TABLE transactions ADD COLUMN account_id INTEGER`, (err) => {});

    db.run(`CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bankName TEXT NOT NULL,
      accountNumber TEXT,
      holderName TEXT NOT NULL,
      balance REAL DEFAULT 0.0
    )`);

    db.run(`ALTER TABLE accounts ADD COLUMN accountNumber TEXT`, (err) => {});

    db.run(`CREATE TABLE IF NOT EXISTS internal_transfers_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromAccount INTEGER,
      toAccount INTEGER,
      amount REAL,
      date TEXT,
      FOREIGN KEY(fromAccount) REFERENCES accounts(id),
      FOREIGN KEY(toAccount) REFERENCES accounts(id)
    )`);
  });
}

const getPasswordFilePath = () => path.join(app.getPath('userData'), '.sys_cache.dat');

function initPasswordFile() {
  const pwdPath = getPasswordFilePath();
  if (!fs.existsSync(pwdPath)) {
    fs.writeFileSync(pwdPath, '9999', 'utf8');
  }
}

app.whenReady().then(() => {
  initDB();
  initPasswordFile();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-inventory', async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM stock_items", [], (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
});

ipcMain.handle('add-item', async (event, item) => {
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO stock_items (name, category, lowStockThreshold, quantity, price) VALUES (?, ?, ?, 0, 0)`;
    const lowStock = item.lowStockThreshold || 5; 
    db.run(query, [item.name, item.category, lowStock], function(err) {
      if (err) reject(err);
      resolve({ id: this.lastID, ...item });
    });
  });
});

ipcMain.handle('update-item', async (event, item) => {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE stock_items SET name = ?, category = ?, lowStockThreshold = ? WHERE id = ?`;
    const lowStock = item.lowStockThreshold || 5;
    db.run(sql, [item.name, item.category, lowStock, item.id], function(err) {
      if (err) reject(err);
      else resolve({ success: true });
    });
  });
});

ipcMain.handle('delete-item', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM stock_items WHERE id = ?`;
    db.run(sql, [id], function(err) {
      if (err) reject(err);
      else resolve({ success: true });
    });
  });
});

ipcMain.handle('add-transaction', async (event, tx) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      const date = new Date().toISOString();
      const accId = tx.account_id;

      db.run(`INSERT INTO transactions (item_id, account_id, type, quantity_changed, total_amount, date, paymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [tx.item_id, accId, tx.type, tx.quantity_changed, tx.total_amount, date, 'Bank Transfer']);

      const operator = tx.type === 'IN' ? '+' : '-';
      db.run(`UPDATE stock_items SET quantity = quantity ${operator} ? WHERE id = ?`, 
        [tx.quantity_changed, tx.item_id], (err) => {
          if (err) {
            db.run("ROLLBACK");
            return reject(err);
          } 
          
          if (accId) {
            const accOp = tx.type === 'OUT' ? '+' : '-'; 
            db.run(`UPDATE accounts SET balance = balance ${accOp} ? WHERE id = ?`, [tx.total_amount, accId], (err) => {
              if (err) { db.run("ROLLBACK"); reject(err); } 
              else { db.run("COMMIT"); resolve({ success: true }); }
            });
          } else {
            db.run("COMMIT");
            resolve({ success: true });
          }
      });
    });
  });
});

ipcMain.handle('update-transaction', async (event, tx) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      db.get(`SELECT item_id, account_id, type, quantity_changed, total_amount, paymentMethod FROM transactions WHERE id = ?`, [tx.id], (err, oldTx) => {
        if (err || !oldTx) { db.run("ROLLBACK"); return reject(err || new Error("Not found")); }
        
        const reverseOp = oldTx.type === 'IN' ? '-' : '+';
        db.run(`UPDATE stock_items SET quantity = quantity ${reverseOp} ? WHERE id = ?`, [oldTx.quantity_changed, oldTx.item_id], (err) => {
          if (err) { db.run("ROLLBACK"); return reject(err); }
          
          const applyOp = tx.type === 'IN' ? '+' : '-';
          db.run(`UPDATE stock_items SET quantity = quantity ${applyOp} ? WHERE id = ?`, [tx.quantity_changed, tx.item_id], (err) => {
            if (err) { db.run("ROLLBACK"); return reject(err); }

            if (oldTx.account_id) {
              const reverseAccOp = oldTx.type === 'OUT' ? '-' : '+';
              db.run(`UPDATE accounts SET balance = balance ${reverseAccOp} ? WHERE id = ?`, [oldTx.total_amount, oldTx.account_id]);
            }

            const accId = tx.account_id;
            if (accId) {
              const applyAccOp = tx.type === 'OUT' ? '+' : '-';
              db.run(`UPDATE accounts SET balance = balance ${applyAccOp} ? WHERE id = ?`, [tx.total_amount, accId]);
            }

            db.run(`UPDATE transactions SET item_id = ?, account_id = ?, type = ?, quantity_changed = ?, total_amount = ?, paymentMethod = ? WHERE id = ?`,
              [tx.item_id, accId, tx.type, tx.quantity_changed, tx.total_amount, 'Bank Transfer', tx.id], (err) => {
                if (err) { db.run("ROLLBACK"); reject(err); } 
                else { db.run("COMMIT"); resolve({ success: true }); }
            });
          });
        });
      });
    });
  });
});

ipcMain.handle('delete-transaction', async (event, id) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      db.get(`SELECT item_id, account_id, type, quantity_changed, total_amount, paymentMethod FROM transactions WHERE id = ?`, [id], (err, tx) => {
        if (err || !tx) { db.run("ROLLBACK"); return reject(err || new Error("Not found")); }
        
        const reverseOperator = tx.type === 'IN' ? '-' : '+';
        db.run(`UPDATE stock_items SET quantity = quantity ${reverseOperator} ? WHERE id = ?`, [tx.quantity_changed, tx.item_id], (err) => {
          if (err) { db.run("ROLLBACK"); return reject(err); }

          if (tx.account_id) {
            const reverseAccOp = tx.type === 'OUT' ? '-' : '+';
            db.run(`UPDATE accounts SET balance = balance ${reverseAccOp} ? WHERE id = ?`, [tx.total_amount, tx.account_id]);
          }

          db.run(`DELETE FROM transactions WHERE id = ?`, [id], (err) => {
            if (err) { db.run("ROLLBACK"); reject(err); } 
            else { db.run("COMMIT"); resolve({ success: true }); }
          });
        });
      });
    });
  });
});

ipcMain.handle('get-transactions', async () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT t.*, s.name AS item_name, a.bankName AS bank_name 
      FROM transactions t 
      JOIN stock_items s ON t.item_id = s.id 
      LEFT JOIN accounts a ON t.account_id = a.id
      ORDER BY t.date DESC
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
});

ipcMain.handle('verify-password', async (event, pwd) => {
  try { return pwd === fs.readFileSync(getPasswordFilePath(), 'utf8').trim(); } catch (err) { return false; }
});
ipcMain.handle('update-password', async (event, newPwd) => {
  try { fs.writeFileSync(getPasswordFilePath(), newPwd.trim(), 'utf8'); return { success: true }; } catch (err) { throw err; }
});
ipcMain.handle('get-accounts', async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM accounts", [], (err, rows) => { if (err) reject(err); resolve(rows); });
  });
});
ipcMain.handle('add-account', async (event, acc) => {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO accounts (bankName, accountNumber, holderName, balance) VALUES (?, ?, ?, ?)`, 
      [acc.bankName, acc.accountNumber, acc.holderName, acc.initialBalance || 0], function(err) {
      if (err) reject(err); resolve({ id: this.lastID, ...acc });
    });
  });
});
ipcMain.handle('update-account', async (event, acc) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE accounts SET bankName = ?, accountNumber = ?, holderName = ?, balance = ? WHERE id = ?`, 
      [acc.bankName, acc.accountNumber, acc.holderName, acc.initialBalance, acc.id], function(err) {
      if (err) reject(err); else resolve({ success: true });
    });
  });
});
ipcMain.handle('delete-account', async (event, id) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM accounts WHERE id = ?`, [id], function(err) { if (err) reject(err); resolve({ success: true }); });
  });
});

ipcMain.handle('adjust-account-balance', async (event, data) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      db.get(`SELECT balance FROM accounts WHERE id = ?`, [data.accountId], (err, row) => {
        if (err || !row) { db.run("ROLLBACK"); return reject(new Error("Account not found.")); }
        if (data.type === 'WITHDRAW' && row.balance < data.amount) {
          db.run("ROLLBACK"); return reject(new Error("Insufficient funds for this withdrawal."));
        }
        const operator = data.type === 'ADD' ? '+' : '-';
        db.run(`UPDATE accounts SET balance = balance ${operator} ? WHERE id = ?`, [data.amount, data.accountId], (err) => {
          if (err) { db.run("ROLLBACK"); return reject(err); }
          const date = new Date().toISOString();
          const fromAcc = data.type === 'WITHDRAW' ? data.accountId : null;
          const toAcc = data.type === 'ADD' ? data.accountId : null;
          db.run(`INSERT INTO internal_transfers_v2 (fromAccount, toAccount, amount, date) VALUES (?, ?, ?, ?)`, 
            [fromAcc, toAcc, data.amount, date], (err) => {
              if (err) { db.run("ROLLBACK"); reject(err); } else { db.run("COMMIT"); resolve({ success: true }); }
          });
        });
      });
    });
  });
});

ipcMain.handle('record-transfer', async (event, transfer) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      db.get(`SELECT balance FROM accounts WHERE id = ?`, [transfer.fromAccount], (err, row) => {
        if (err) { db.run("ROLLBACK"); return reject(err); }
        if (!row || row.balance < transfer.amount) { db.run("ROLLBACK"); return reject(new Error("Insufficient funds in the source account.")); }
        const date = new Date().toISOString();
        db.run(`INSERT INTO internal_transfers_v2 (fromAccount, toAccount, amount, date) VALUES (?, ?, ?, ?)`, [transfer.fromAccount, transfer.toAccount, transfer.amount, date]);
        db.run(`UPDATE accounts SET balance = balance - ? WHERE id = ?`, [transfer.amount, transfer.fromAccount], (err) => {
            if (err) { db.run("ROLLBACK"); return reject(err); } 
            db.run(`UPDATE accounts SET balance = balance + ? WHERE id = ?`, [transfer.amount, transfer.toAccount], (err) => {
                if (err) { db.run("ROLLBACK"); reject(err); } else { db.run("COMMIT"); resolve({ success: true }); }
            });
        });
      });
    });
  });
});

ipcMain.handle('get-transfers', async () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT t.*, a1.bankName AS fromBank, a1.holderName AS fromHolder, a2.bankName AS toBank, a2.holderName AS toHolder
      FROM internal_transfers_v2 t LEFT JOIN accounts a1 ON t.fromAccount = a1.id LEFT JOIN accounts a2 ON t.toAccount = a2.id ORDER BY t.date DESC
    `;
    db.all(query, [], (err, rows) => { if (err) reject(err); resolve(rows); });
  });
});

ipcMain.handle('export-data', async (event, savedPath) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT t.date, s.name AS item_name, t.type, a.bankName, t.quantity_changed, t.total_amount
      FROM transactions t
      JOIN stock_items s ON t.item_id = s.id
      LEFT JOIN accounts a ON t.account_id = a.id
      ORDER BY t.date DESC
    `;
    
    db.all(query, [], async (err, rows) => {
      if (err) return reject(err);

      let csvContent = "Date & Time,Item Name,Transaction Type,Bank Account,Quantity Changed,Total Amount (Rs)\n";
      
      rows.forEach(row => {
        const dateObj = new Date(row.date);
        const formattedDate = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString()}`.replace(/,/g, '');
        const bank = row.bankName ? row.bankName : 'Legacy Data (Cash)';
        const type = row.type === 'IN' ? 'Stock IN' : 'Stock OUT';
        
        csvContent += `${formattedDate},"${row.item_name}",${type},"${bank}",${row.quantity_changed},${row.total_amount}\n`;
      });

      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export TradeStock Data to Excel',
        defaultPath: savedPath || 'TradeStock_Transactions.csv',
        filters: [{ name: 'Excel (CSV)', extensions: ['csv'] }]
      });

      if (filePath) {
        try {
          fs.writeFileSync(filePath, csvContent, 'utf8');
          resolve({ success: true, path: filePath });
        } catch (e) {
          reject(e);
        }
      } else {
        resolve({ success: false, canceled: true });
      }
    });
  });
});

ipcMain.handle('import-csv', async (event, items) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      const stmt = db.prepare(`INSERT INTO stock_items (name, category, lowStockThreshold, quantity, price) VALUES (?, ?, ?, 0, 0)`);
      items.forEach(item => {
        const lowStock = item.lowStockThreshold || 5;
        stmt.run([item.name, item.category, lowStock]);
      });
      stmt.finalize();
      db.run("COMMIT", (err) => {
        if (err) {
          db.run("ROLLBACK");
          reject(err);
        } else {
          resolve({ success: true });
        }
      });
    });
  });
});

ipcMain.handle('backup-database', async () => {
  const backupPathFile = path.join(app.getPath('userData'), '.backup_path.dat');
  let defaultPath = 'tradestock_backup.db';
  if (fs.existsSync(backupPathFile)) {
    defaultPath = fs.readFileSync(backupPathFile, 'utf8').trim();
  }

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save TradeStock Backup',
    defaultPath: defaultPath,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }]
  });

  if (filePath) {
    const dbPath = path.join(app.getPath('userData'), 'tradestock.db');
    fs.copyFileSync(dbPath, filePath);
    fs.writeFileSync(backupPathFile, filePath, 'utf8');
    return { success: true, path: filePath };
  }
  return { success: false };
});

// --- FIX: SILENT PDF GENERATION & INSTANT NATIVE OPEN ---
ipcMain.handle('print-preview', async () => {
  try {
    // 1. Instantly generate perfect PDF in the background
    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4'
    });
    
    // 2. Save it silently to the computer's junk temp folder
    const tempPath = path.join(app.getPath('temp'), 'TradeStock_Report_Preview.pdf');
    fs.writeFileSync(tempPath, pdfData);

    // 3. Command Windows to open it using the default PDF Viewer (Edge/Adobe)
    await shell.openPath(tempPath);
    
    return { success: true };
  } catch (error) {
    console.error("Print Error: ", error);
    return { success: false, error: error.message };
  }
});