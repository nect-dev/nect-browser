// アプリケーションのメインプロセス
import { app, BaseWindow, ipcMain, WebContentsView } from "electron";
import * as path from "path";
import { BrowserManager } from "./managers//BrowserManager";
import { SidebarManager } from "./managers/SidebarManager";

// ウィンドウの設定値
const WINDOW_CONFIG = {
  UI_HEIGHT: 80,
  INITIAL_WIDTH: 1200,
  INITIAL_HEIGHT: 800,
  SIDEBAR_WIDTH: 300,
} as const;

// ウィンドウの状態管理オブジェクト
const windows: {
  mainWindow: BaseWindow | null;
  uiView: WebContentsView | null;
  browserManager: BrowserManager | null;
  sidebarManager: SidebarManager | null;
} = {
  mainWindow: null,
  uiView: null,
  browserManager: null,
  sidebarManager: null,
};

// メインウィンドウとUIビューを作成
function createMainWindow() {
  const win = new BaseWindow({
    width: WINDOW_CONFIG.INITIAL_WIDTH,
    height: WINDOW_CONFIG.INITIAL_HEIGHT,
  });

  const uiView = new WebContentsView({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.contentView.addChildView(uiView);

  const [width, _height] = win.getContentSize();

  uiView.setBounds({
    x: 0,
    y: 0,
    width: width,
    height: WINDOW_CONFIG.UI_HEIGHT,
  });

  if (!app.isPackaged) {
    uiView.webContents.loadURL("http://localhost:5173/main.html");
    uiView.webContents.openDevTools({ mode: "detach" });
  } else {
    uiView.webContents.loadFile(path.join(__dirname, "../src/main.html"));
  }

  // ウィンドウリサイズ時の処理
  win.on("resize", () => {
    const [width, height] = win.getContentSize();

    // UIビューのサイズ更新
    uiView.setBounds({
      x: 0,
      y: 0,
      width,
      height: WINDOW_CONFIG.UI_HEIGHT,
    });

    // サイドバーとブラウザビューの更新
    if (windows.sidebarManager?.getVisibility()) {
      // サイドバーの位置とサイズを更新
      const sidebarBounds = {
        x: width - WINDOW_CONFIG.SIDEBAR_WIDTH,
        y: WINDOW_CONFIG.UI_HEIGHT,
        width: WINDOW_CONFIG.SIDEBAR_WIDTH,
        height: height - WINDOW_CONFIG.UI_HEIGHT,
      };
      windows.sidebarManager.updateBounds(sidebarBounds);

      // アクティブタブのサイズを更新
      if (windows.browserManager) {
        const activeTab = windows.browserManager.getActiveTab();
        if (activeTab) {
          activeTab.view.setBounds({
            x: 0,
            y: WINDOW_CONFIG.UI_HEIGHT,
            width: width - WINDOW_CONFIG.SIDEBAR_WIDTH,
            height: height - WINDOW_CONFIG.UI_HEIGHT,
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
            y: WINDOW_CONFIG.UI_HEIGHT,
            width: width,
            height: height - WINDOW_CONFIG.UI_HEIGHT,
          });
        }
      }
    }
  });

  return { win, uiView };
}

// アプリケーションの初期化処理を実行
function initializeApp() {
  const main = createMainWindow();
  windows.mainWindow = main.win;
  windows.uiView = main.uiView;

  // サイドバーマネージャーの初期化
  windows.sidebarManager = new SidebarManager(WINDOW_CONFIG.UI_HEIGHT);
  windows.mainWindow.contentView.addChildView(windows.sidebarManager.getView());

  // ブラウザマネージャーの初期化
  windows.browserManager = new BrowserManager(main.win);
  windows.browserManager.createTab("tab-1", "about:blank");
  windows.browserManager.switchTab("tab-1");

  // イベントハンドラーの設定
  windows.browserManager.on("title-updated", ({ tabId, title }) => {
    windows.uiView?.webContents.send("title-changed", { tabId, title });
  });

  windows.browserManager.on("url-updated", ({ tabId, url }) => {
    windows.uiView?.webContents.send("url-changed", { tabId, url });
  });

  windows.sidebarManager.on("visibility-changed", (isVisible) => {
    windows.uiView?.webContents.send("sidebar-visibility-changed", { isVisible });
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
      case "maximize":
        windows.mainWindow.maximize();
        break;
      case "close":
        windows.mainWindow.close();
        break;
    }
  });

  // URLの読み込み
  ipcMain.on("load-url", async (_, { tabId, url }) => {
    if (!windows.browserManager || !windows.uiView) return;
    await windows.browserManager.loadURL(tabId, url);

    // タブの情報を取得して更新を通知
    const info = windows.browserManager.getTabInfo(tabId);
    if (info) {
      windows.uiView.webContents.send("url-changed", {
        tabId,
        url: info.url,
      });
      windows.uiView.webContents.send("title-changed", {
        tabId,
        title: info.title || url,
      });
    }
  });

  // 履歴の移動
  ipcMain.on("navigate-history", async (_, { tabId, direction }) => {
    if (!windows.browserManager) return;
    await windows.browserManager.navigateHistory(tabId, direction);
  });

  // タブのリロード
  ipcMain.on("reload-tab", (_, { tabId }) => {
    if (!windows.browserManager) return;
    windows.browserManager.reloadTab(tabId);
  });

  // サイドバーの表示切り替え
  ipcMain.on("toggle-sidebar", () => {
    if (!windows.mainWindow || !windows.sidebarManager) return;

    const [width, height] = windows.mainWindow.getContentSize();

    // サイドバーの位置とサイズを計算
    const sidebarBounds = {
      x: width - WINDOW_CONFIG.SIDEBAR_WIDTH,
      y: WINDOW_CONFIG.UI_HEIGHT,
      width: WINDOW_CONFIG.SIDEBAR_WIDTH,
      height: height - WINDOW_CONFIG.UI_HEIGHT,
    };

    // サイドバーの表示を切り替え
    windows.sidebarManager.toggle(sidebarBounds);

    // ブラウザビューのサイズを調整
    if (windows.browserManager) {
      const activeTab = windows.browserManager.getActiveTab();
      if (activeTab) {
        activeTab.view.setBounds({
          x: 0,
          y: WINDOW_CONFIG.UI_HEIGHT,
          width: width - (windows.sidebarManager.getVisibility() ? WINDOW_CONFIG.SIDEBAR_WIDTH : 0),
          height: height - WINDOW_CONFIG.UI_HEIGHT,
        });
      }
    }
  });

  // タブの作成
  ipcMain.on("create-tab", (_, { tabId, url }) => {
    if (!windows.browserManager || !windows.uiView) return;

    windows.browserManager.createTab(tabId, url || "about:blank");
    const info = windows.browserManager.switchTab(tabId);
    windows.uiView.webContents.send("tab-created", { tabId, ...info });
  });

  // タブの切り替え
  ipcMain.on("switch-tab", (_, { tabId }) => {
    if (!windows.browserManager || !windows.uiView) return;

    const info = windows.browserManager.switchTab(tabId);
    if (info) {
      windows.uiView.webContents.send("tab-switched", { tabId, ...info });
    }
  });

  // タブを閉じる
  ipcMain.on("close-tab", (_, { tabId }) => {
    if (!windows.browserManager) return;
    windows.browserManager.closeTab(tabId);
    windows.uiView.webContents.send("tab-closed", { tabId });
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
