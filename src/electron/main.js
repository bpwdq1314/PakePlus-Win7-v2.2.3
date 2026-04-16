const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

process.on('uncaughtException', (err) => {
  fs.appendFileSync('error.log', `[${new Date().toISOString()}] Uncaught: ${err.stack}\n`);
});

process.on('unhandledRejection', (reason) => {
  fs.appendFileSync('error.log', `[${new Date().toISOString()}] Unhandled: ${reason}\n`);
});

let mainWindow;
let server;

function createWindow() {
  const isDev = !app.isPackaged;
  const preloadPath = path.join(__dirname, 'preload.js');

  let distPath;
  if (isDev) {
    distPath = path.join(__dirname, '..', 'dist');
  } else {
    distPath = path.join(__dirname, '..', 'dist');
  }

  const isLinux = process.platform === 'linux';
  const isArm = process.arch.includes('arm') || process.arch.includes('aarch64');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webgl: isArm ? false : true,
      enableWebSQL: false,
      spellcheck: false,
      navigateOnDragDrop: false,
    },
  });

  if (isArm && isLinux) {
    mainWindow.disableHardwareAcceleration();
  }

  const indexPath = path.join(distPath, 'index.html');

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
    console.error('Failed to load:', errorCode, errorDesc);
    fs.appendFileSync('error.log', `[${new Date().toISOString()}] Failed: ${errorCode} ${errorDesc}\n`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Finish load event fired');
  });

  if (isDev) {
    mainWindow.loadFile(indexPath).then(() => {
      console.log('loadFile promise resolved');
    }).catch((err) => {
      console.error('loadFile promise rejected:', err);
      fs.appendFileSync('error.log', `[${new Date().toISOString()}] LoadError: ${err}\n`);
    });
  } else {
    mainWindow.loadURL('http://localhost:3456').then(() => {
      console.log('loadURL promise resolved');
    }).catch((err) => {
      console.error('loadURL promise rejected:', err);
      fs.appendFileSync('error.log', `[${new Date().toISOString()}] LoadError: ${err}\n`);
    });
  }

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startHttpServer() {
  const distPath = path.join(__dirname, '..', 'dist');
  const port = 3456;

  const contentTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  server = http.createServer((req, res) => {
    let filePath = path.join(distPath, req.url === '/' ? 'index.html' : req.url);

    if (!filePath.startsWith(distPath)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = contentTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          fs.readFile(path.join(distPath, 'index.html'), (err2, content2) => {
            if (err2) {
              res.writeHead(500);
              res.end('Server Error');
            } else {
              res.writeHead(200, {
                'Content-Type': 'text/html',
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
              });
              res.end(content2);
            }
          });
        } else {
          res.writeHead(500);
          res.end('Server Error');
        }
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
        });
        res.end(content);
      }
    });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`HTTP Server running on http://localhost:${port}`);
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  if (app.isPackaged) {
    startHttpServer();
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.handle('load-file', async (event, { fileName }) => {
  try {
    const userDataPath = app.getPath('userData');
    const fullPath = path.join(userDataPath, fileName);
    if (!fullPath.startsWith(userDataPath)) {
      return null;
    }
    const data = fs.readFileSync(fullPath);
    return data;
  } catch (error) {
    return null;
  }
});

ipcMain.handle('save-file', async (event, { fileName, data }) => {
  try {
    const userDataPath = app.getPath('userData');
    const fullPath = path.join(userDataPath, fileName);
    if (!fullPath.startsWith(userDataPath)) {
      return false;
    }
    fs.writeFileSync(fullPath, Buffer.from(data));
    return true;
  } catch (error) {
    console.error('Save file error:', error);
    return false;
  }
});

ipcMain.handle('get-app-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('get-wasm-path', () => {
  return path.join(__dirname, '..', 'dist', 'sql-wasm.wasm');
});

ipcMain.handle('get-wasm-binary', () => {
  const wasmPath = path.join(__dirname, '..', 'dist', 'sql-wasm.wasm');
  try {
    const data = fs.readFileSync(wasmPath);
    return data;
  } catch (error) {
    console.error('Failed to read wasm:', error);
    return null;
  }
});