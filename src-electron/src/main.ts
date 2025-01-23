import { app, BaseWindow, ipcMain, WebContentsView } from 'electron';
import * as path from 'path';
import { BrowserManager } from './BrowserManager';

interface AppWindows {
  mainWindow: BaseWindow | null;
  uiView: WebContentsView | null;
  sidebarWindow: BaseWindow | null;
  sidebarView: WebContentsView | null;
  browserManager: BrowserManager | null;
}

const windows: AppWindows = {
  mainWindow: null,
  uiView: null,
  sidebarWindow: null,
  sidebarView: null,
  browserManager: null,
};

const UI_HEIGHT = 80;

function createMainWindow() {
  const win = new BaseWindow({
    width: 1200,
    height: 800,
    //frame: false,
  });

  const uiView = new WebContentsView({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  win.contentView.addChildView(uiView);
  uiView.setBounds({ x: 0, y: 0, width: 1200, height: UI_HEIGHT });

  if (!app.isPackaged) {
    uiView.webContents.loadURL('http://localhost:5173/main.html');
    uiView.webContents.openDevTools({ mode: 'detach' });
  } else {
    uiView.webContents.loadFile(path.join(__dirname, '../../src/main.html'));
  }

  windows.browserManager = new BrowserManager(win);

  win.on('resize', () => {
    const [width, height] = win.getSize();
    uiView.setBounds({ x: 0, y: 0, width, height: UI_HEIGHT });
  });

  windows.browserManager.on('title-updated', ({ tabId, title }) => {
    uiView.webContents.send('title-changed', { tabId, title });
  });

  windows.browserManager.on('url-updated', ({ tabId, url }) => {
    uiView.webContents.send('url-changed', { tabId, url });
  });

  return { win, uiView };
}

function createSidebarWindow() {
  const win = new BaseWindow({
    width: 300,
    height: 800,
    frame: false,
    parent: windows.mainWindow!,
    show: false,
  });

  const view = new WebContentsView({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  win.contentView.addChildView(view);
  view.setBounds({ x: 0, y: 0, width: 300, height: 800 });

  if (!app.isPackaged) {
    view.webContents.loadURL('http://localhost:5173/sidebar.html');
  } else {
    view.webContents.loadFile(path.join(__dirname, '../../src/sidebar.html'));
  }

  win.on('resize', () => {
    const [width, height] = win.getSize();
    view.setBounds({ x: 0, y: 0, width, height });
  });

  return { win, view };
}

app.whenReady().then(() => {
  const main = createMainWindow();
  windows.mainWindow = main.win;
  windows.uiView = main.uiView;

  windows.browserManager?.createTab('tab-1', 'about:blank');
  windows.browserManager?.switchTab('tab-1');

  const sidebar = createSidebarWindow();
  windows.sidebarWindow = sidebar.win;
  windows.sidebarView = sidebar.view;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!windows.mainWindow) {
    const main = createMainWindow();
    windows.mainWindow = main.win;
    windows.uiView = main.uiView;

    windows.browserManager?.createTab('tab-1', 'about:blank');
    windows.browserManager?.switchTab('tab-1');

    const sidebar = createSidebarWindow();
    windows.sidebarWindow = sidebar.win;
    windows.sidebarView = sidebar.view;
  }
});

ipcMain.on('window-control', (_, command: string) => {
  switch (command) {
    case 'minimize':
      windows.mainWindow?.minimize();
      break;
    case 'maximize': {
      windows.mainWindow?.maximize();
      break;
    }
    case 'close':
      windows.mainWindow?.close();
      break;
  }
});

ipcMain.on('toggle-sidebar', () => {
  if (windows.sidebarWindow?.isVisible()) {
    windows.sidebarWindow.hide();
  } else {
    windows.sidebarWindow?.show();
  }
});

ipcMain.on('create-tab', async (event, { tabId, url }) => {
  try {
    windows.browserManager?.createTab(tabId, url || 'about:blank');
    const info = windows.browserManager?.getTabInfo(tabId);
    windows.uiView?.webContents.send('tab-created', { tabId, ...info });
  } catch (error) {
    console.error('Error creating tab:', error);
  }
});

ipcMain.on('switch-tab', async (event, { tabId }) => {
  try {
    const info = await windows.browserManager?.switchTab(tabId);
    windows.uiView?.webContents.send('tab-switched', { tabId, ...info });
  } catch (error) {
    console.error('Error switching tab:', error);
  }
});