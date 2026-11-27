const { app, BrowserWindow, clipboard, dialog, ipcMain, net, protocol, safeStorage, screen, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const origin = 'keroppilot://app';
protocol.registerSchemesAsPrivileged([{ scheme: 'keroppilot', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
} }]);

let mainWindow;
function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function start() {
  const root = path.join(__dirname, 'dist');
  protocol.handle('keroppilot', async request => {
    const url = new URL(request.url);
    if (url.host !== 'app' || request.method !== 'GET') return new Response(null, { status: 403 });
    const pathname = decodeURIComponent(url.pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return new Response(null, { status: 404 });
    const response = await net.fetch(pathToFileURL(file).href);
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.deepseek.com; object-src 'none'; base-uri 'none'; frame-src 'none'");
    return new Response(response.body, { status: response.status, headers });
  });
  const keyFile = path.join(app.getPath('userData'), 'deepseek.key');
  function handle(channel, action) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!mainWindow || event.senderFrame !== mainWindow.webContents.mainFrame ||
          !event.senderFrame.url.startsWith(origin + '/')) throw new Error('无效窗口');
      return action(...args);
    });
  }
  handle('key:read', () => {
    if (fs.existsSync(keyFile)) return { key: safeStorage.decryptString(fs.readFileSync(keyFile)), source: 'file' };
    const key = process.env.DEEPSEEK_API_KEY || '';
    return { key, source: key ? 'env' : 'none' };
  });
  handle('key:save', key => {
    if (typeof key !== 'string' || !key || key.length > 512) throw new Error('API Key 格式错误');
    fs.writeFileSync(keyFile + '.tmp', safeStorage.encryptString(key));
    fs.renameSync(keyFile + '.tmp', keyFile);
    return { key, source: 'file' };
  });
  handle('key:clear', () => fs.rmSync(keyFile, { force: true }));
  handle('window:pin', value => mainWindow.setAlwaysOnTop(value === true));
  handle('clipboard:copy', text => clipboard.writeText(String(text)));
  handle('external:open', destination => {
    const url = { chatgpt: 'https://chatgpt.com/', deepseek: 'https://platform.deepseek.com/api_keys' }[destination];
    if (typeof url === 'string') return shell.openExternal(url);
  });
  const work = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const width = Math.min(460, work.width);
  mainWindow = new BrowserWindow({
    title: 'KEROPPILOT', width, height: Math.min(900, work.height),
    minWidth: Math.min(380, work.width), minHeight: Math.min(560, work.height),
    x: work.x + work.width - width, y: work.y, icon: path.join(__dirname, 'icon.ico'),
    alwaysOnTop: true, autoHideMenuBar: true, backgroundColor: '#0e0e0c',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.setMenu(null);
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  await mainWindow.loadURL(origin + '/');
  showWindow();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(start).catch(error => {
    dialog.showErrorBox('KEROPPILOT 启动失败', error.message);
    app.quit();
  });
}
