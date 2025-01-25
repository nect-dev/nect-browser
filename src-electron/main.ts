import { app, BaseWindow, ipcMain, WebContentsView } from "electron";
import * as path from "path";
import { BrowserManager } from "./managers//BrowserManager";
import { SidebarManager } from "./managers/SidebarManager";

// ウィンドウの設定値
const WINDOW_CONFIG = {
  HEADER_HEIGHT: 80,
  SIDEBAR_WIDTH: 300,
} as const;

// ウィンドウの状態管理オブジェクト
const windows: {
  mainWindow: BaseWindow | null;
  headerView: WebContentsView | null;
  browserManager: BrowserManager | null;
  sidebarManager: SidebarManager | null;
} = {
  mainWindow: null,
  headerView: null,
  browserManager: null,
  sidebarManager: null,
};

// メインウィンドウとヘッダービューを作成
function createMainWindow() {
  const win = new BaseWindow({
    width: 1200,
    height: 800,
    frame: false,
  });

  const headerView = new WebContentsView({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.contentView.addChildView(headerView);

  const [width] = win.getContentSize();

  headerView.setBounds({
    x: 0,
    y: 0,
    width: width,
    height: WINDOW_CONFIG.HEADER_HEIGHT,
  });

  if (!app.isPackaged) {
    headerView.webContents.loadURL("http://localhost:5173/main.html");
    headerView.webContents.openDevTools({ mode: "detach" });
  } else {
    headerView.webContents.loadFile(path.join(__dirname, "../src/main.html"));
  }

  const updateWebviewSize = () => {
    const [width, height] = win.getContentSize();

    // ヘッダーのサイズ更新
    headerView.setBounds({
      x: 0,
      y: 0,
      width,
      height: WINDOW_CONFIG.HEADER_HEIGHT,
    });

    // サイドバーとブラウザビューの更新
    if (windows.sidebarManager?.getVisibility()) {
      // サイドバーの位置とサイズを更新
      const sidebarBounds = {
        x: 0,
        y: WINDOW_CONFIG.HEADER_HEIGHT,
        width: WINDOW_CONFIG.SIDEBAR_WIDTH,
        height: height - WINDOW_CONFIG.HEADER_HEIGHT,
      };
      windows.sidebarManager.updateBounds(sidebarBounds);

      // アクティブタブのサイズと位置を更新
      if (windows.browserManager) {
        const activeTab = windows.browserManager.getActiveTab();
        if (activeTab) {
          activeTab.view.setBounds({
            x: WINDOW_CONFIG.SIDEBAR_WIDTH,
            y: WINDOW_CONFIG.HEADER_HEIGHT,
            width: width - WINDOW_CONFIG.SIDEBAR_WIDTH,
            height: height - WINDOW_CONFIG.HEADER_HEIGHT,
          });
        }
      }
    } else {
      // サイドバーが非表示の場合、ブラウザビューを全幅に
      if (windows.browserManager) {
        const activeTab = windows.browserManager.getActiveTab();
        if (activeTab) {
          activeTab.view.setBounds({
            x: 0,
            y: WINDOW_CONFIG.HEADER_HEIGHT,
            width: width,
            height: height - WINDOW_CONFIG.HEADER_HEIGHT,
          });
        }
      }
    }
  };

  // ウィンドウリサイズ時の処理
  win.on("move", updateWebviewSize);
  win.on("restore", updateWebviewSize);
  win.on("maximize", updateWebviewSize);
  win.on("unmaximize", updateWebviewSize);
  win.on("resize", updateWebviewSize);

  return { win, headerView };
}

// アプリケーションの初期化処理を実行
function initializeApp() {
  const main = createMainWindow();
  windows.mainWindow = main.win;
  windows.headerView = main.headerView;

  // サイドバーマネージャーの初期化
  windows.sidebarManager = new SidebarManager(WINDOW_CONFIG.HEADER_HEIGHT);
  windows.mainWindow.contentView.addChildView(windows.sidebarManager.getView());

  // ブラウザマネージャーの初期化
  windows.browserManager = new BrowserManager(main.win);
  windows.browserManager.createTab("tab-1", "about:blank");
  windows.browserManager.switchTab("tab-1");

  // イベントハンドラーの設定
  windows.browserManager.on("title-updated", ({ tabId, title }) => {
    windows.headerView?.webContents.send("title-changed", { tabId, title });
  });

  windows.browserManager.on("url-updated", ({ tabId, url }) => {
    windows.headerView?.webContents.send("url-changed", { tabId, url });
  });

  windows.browserManager.on("navigation-state-changed", ({ tabId, canGoBack, canGoForward }) => {
    windows.headerView?.webContents.send("navigation-state-changed", {
      tabId,
      canGoBack,
      canGoForward,
    });
  });
}

function setupIpcHandlers() {
  // ウィンドウコントロール
  ipcMain.on("window-control", (_, command: string) => {
    if (!windows.mainWindow) return;

    switch (command) {
      case "minimize":
        windows.mainWindow.minimize();
        break;
      case "toggle-maximize":
        if (windows.mainWindow.isMaximized()) {
          windows.mainWindow.unmaximize();
        } else {
          windows.mainWindow.maximize();
        }
        break;
      case "close":
        windows.mainWindow.close();
        break;
    }
  });

  // タブの作成
  ipcMain.on("create-tab", (_, { tabId, url }) => {
    if (!windows.browserManager || !windows.headerView) return;

    windows.browserManager.createTab(tabId, url || "about:blank");
    const info = windows.browserManager.switchTab(tabId);
    windows.headerView.webContents.send("tab-created", { tabId, ...info });
  });

  // タブのリロード
  ipcMain.on("reload-tab", (_, { tabId }) => {
    if (!windows.browserManager) return;
    windows.browserManager.reloadTab(tabId);
  });

  // タブの切り替え
  ipcMain.on("switch-tab", (_, { tabId }) => {
    if (!windows.browserManager || !windows.headerView) return;

    const info = windows.browserManager.switchTab(tabId);
    if (info) {
      windows.headerView.webContents.send("tab-switched", { tabId, ...info });
      const tab = windows.browserManager.getTabInfo(tabId);
      if (tab) {
        windows.headerView.webContents.send("navigation-state-changed", {
          tabId,
          canGoBack: info.canGoBack,
          canGoForward: info.canGoForward,
        });
      }
    }
  });

  // URLの読み込み
  ipcMain.on("load-url", async (_, { tabId, url }) => {
    if (!windows.browserManager || !windows.headerView) return;

    const success = await windows.browserManager.loadURL(tabId, url);
    if (success) {
      const info = windows.browserManager.getTabInfo(tabId);
      if (info) {
        windows.headerView.webContents.send("navigation-state-changed", {
          tabId,
          canGoBack: info.canGoBack,
          canGoForward: info.canGoForward,
        });
      }
    }
  });

  // 履歴の移動
  ipcMain.on("navigate-history", async (_, { tabId, direction }) => {
    if (!windows.browserManager || !windows.headerView) return;

    const success = await windows.browserManager.navigateHistory(tabId, direction);
    if (success) {
      const info = windows.browserManager.getTabInfo(tabId);
      if (info) {
        windows.headerView.webContents.send("navigation-state-changed", {
          tabId,
          canGoBack: info.canGoBack,
          canGoForward: info.canGoForward,
        });
      }
    }
  });

  // サイドバーの表示切り替え
  ipcMain.on("toggle-sidebar", () => {
    if (!windows.mainWindow || !windows.sidebarManager) return;

    const [width, height] = windows.mainWindow.getContentSize();

    const sidebarBounds = {
      x: 0,
      y: WINDOW_CONFIG.HEADER_HEIGHT,
      width: WINDOW_CONFIG.SIDEBAR_WIDTH,
      height: height - WINDOW_CONFIG.HEADER_HEIGHT,
    };

    windows.sidebarManager.toggle(sidebarBounds);

    if (windows.browserManager) {
      const activeTab = windows.browserManager.getActiveTab();
      if (activeTab) {
        activeTab.view.setBounds({
          x: windows.sidebarManager.getVisibility() ? WINDOW_CONFIG.SIDEBAR_WIDTH : 0,
          y: WINDOW_CONFIG.HEADER_HEIGHT,
          width: width - (windows.sidebarManager.getVisibility() ? WINDOW_CONFIG.SIDEBAR_WIDTH : 0),
          height: height - WINDOW_CONFIG.HEADER_HEIGHT,
        });
      }
    }
  });

  // タブを閉じる
  ipcMain.on("close-tab", (_, { tabId }) => {
    if (!windows.browserManager) return;
    windows.browserManager.closeTab(tabId);
    windows.headerView.webContents.send("tab-closed", { tabId });
  });
}

// アプリケーションの起動処理
app.whenReady().then(() => {
  initializeApp();
  setupIpcHandlers();
});

// すべてのウィンドウが閉じられた時の処理
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// アプリケーションがアクティブになった時の処理
app.on("activate", () => {
  if (!windows.mainWindow) {
    initializeApp();
    setupIpcHandlers();
  }
});
