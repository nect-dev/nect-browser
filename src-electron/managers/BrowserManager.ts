import { BaseWindow, WebContentsView } from "electron";
import { EventEmitter } from "events";

// 履歴エントリーのインターフェース
interface History {
  url: string;
  title: string;
}

// タブの情報を格納するインターフェース
interface Tab {
  id: string;
  view: WebContentsView;
  history: History[];
  currentIndex: number;
  cleanup: () => void;
}

// タブの情報を返すインターフェース
interface TabInfo {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export class BrowserManager extends EventEmitter {
  private mainWindow: BaseWindow;
  private tabs: Map<string, Tab>;
  private activeTabId: string | null;

  constructor(mainWindow: BaseWindow) {
    super();
    this.mainWindow = mainWindow;
    this.tabs = new Map();
    this.activeTabId = null;

    const resizeHandler = () => this.updateActiveViewBounds();
    this.mainWindow.on("resize", resizeHandler);

    this.cleanup = () => {
      this.mainWindow.removeListener("resize", resizeHandler);
      Array.from(this.tabs.keys()).forEach((tabId) => this.closeTab(tabId));
    };
  }

  // アクティブなタブのビューサイズを更新
  private updateActiveViewBounds(): void {
    if (!this.activeTabId) return;

    const [width, height] = this.mainWindow.getSize();
    const view = this.tabs.get(this.activeTabId)?.view;
    const HEADER_SIZE = 80; // ヘッダー部分のための余白

    if (view) {
      view.setBounds({
        x: 0,
        y: HEADER_SIZE,
        width,
        height: height - HEADER_SIZE,
      });
    }
  }

  private updateTabState(tabId: string, url: string, title: string): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    // 履歴を更新
    tab.history = tab.history.slice(0, tab.currentIndex + 1);
    tab.history.push({ url, title });
    tab.currentIndex++;

    // 状態更新を通知
    this.emit("url-updated", { tabId, url });
    this.emit("title-updated", { tabId, title });
    this.emitNavigationState(tabId);
  }

  private setupViewEvents(tabId: string, view: WebContentsView): () => void {
    // タイトルのみが更新された場合
    const titleHandler = (_: Event, title: string) => {
      const tab = this.tabs.get(tabId);
      if (tab && tab.history[tab.currentIndex]) {
        tab.history[tab.currentIndex].title = title;
        this.emit("title-updated", { tabId, title });
      }
    };

    // 新しいページへのナビゲーション
    const navigationHandler = (_: Event, url: string) => {
      const title = view.webContents.getTitle();
      this.updateTabState(tabId, url, title);
    };

    // ページ内ナビゲーション（History API, ハッシュ変更）
    const inPageHandler = (_: Event, url: string) => {
      const title = view.webContents.getTitle();
      this.updateTabState(tabId, url, title);
    };

    // ページ読み込み開始時 - URLのみ更新
    const loadStartHandler = () => {
      const url = view.webContents.getURL();
      this.emit("url-updated", { tabId, url });
    };

    // イベントリスナーを登録
    view.webContents.on("page-title-updated", titleHandler);
    view.webContents.on("did-navigate", navigationHandler);
    view.webContents.on("did-navigate-in-page", inPageHandler);
    view.webContents.on("did-start-loading", loadStartHandler);

    // クリーンアップ関数を返す
    return () => {
      view.webContents.removeListener("page-title-updated", titleHandler);
      view.webContents.removeListener("did-navigate", navigationHandler);
      view.webContents.removeListener("did-navigate-in-page", inPageHandler);
      view.webContents.removeListener("did-start-loading", loadStartHandler);
    };
  }

  private emitNavigationState(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    this.emit("navigation-state-changed", {
      tabId,
      canGoBack: tab.currentIndex > 0,
      canGoForward: tab.currentIndex < tab.history.length - 1,
    });
  }

  // 新しいタブを作成
  createTab(tabId: string, url: string = "about:blank"): string {
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webviewTag: true,
        allowRunningInsecureContent: false,
      },
    });

    view.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    view.webContents.on("will-navigate", (event, url) => {
      this.emit("url-updated", { tabId, url });
    });

    const cleanup = this.setupViewEvents(tabId, view);

    this.tabs.set(tabId, {
      id: tabId,
      view,
      history: [{ url, title: "New Tab" }],
      currentIndex: 0,
      cleanup,
    });

    view.webContents.loadURL(url);
    return tabId;
  }

  // タブを切り替え
  switchTab(tabId: string): TabInfo | null {
    if (!this.tabs.has(tabId)) return null;

    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      this.mainWindow.contentView.removeChildView(this.tabs.get(this.activeTabId)!.view);
    }

    const tab = this.tabs.get(tabId)!;
    this.mainWindow.contentView.addChildView(tab.view);
    this.activeTabId = tabId;
    this.updateActiveViewBounds();

    const currentEntry = tab.history[tab.currentIndex];
    return {
      url: currentEntry.url,
      title: currentEntry.title,
      canGoBack: tab.currentIndex > 0,
      canGoForward: tab.currentIndex < tab.history.length - 1,
    };
  }

  // タブを閉じる
  closeTab(tabId: string): boolean {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    if (this.activeTabId === tabId) {
      this.mainWindow.contentView.removeChildView(tab.view);
      this.activeTabId = null;
    }

    tab.cleanup();
    tab.view.webContents.close();
    return this.tabs.delete(tabId);
  }

  // 指定したタブで新しいURLを読み込む
  async loadURL(tabId: string, url: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    try {
      await tab.view.webContents.loadURL(url);
      return true;
    } catch (error) {
      console.error(`Failed to load URL: ${url}`, error);
      return false;
    }
  }

  // タブの履歴を前後に移動
  async navigateHistory(tabId: string, direction: "back" | "forward"): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    let newIndex = tab.currentIndex;
    if (direction === "back" && tab.currentIndex > 0) {
      newIndex--;
    } else if (direction === "forward" && tab.currentIndex < tab.history.length - 1) {
      newIndex++;
    } else {
      return false;
    }

    const entry = tab.history[newIndex];
    try {
      await tab.view.webContents.loadURL(entry.url);
      tab.currentIndex = newIndex;
      this.emit("url-updated", { tabId, url: entry.url });
      this.emit("title-updated", { tabId, title: entry.title });
      this.emitNavigationState(tabId);
      return true;
    } catch (error) {
      console.error(`Failed to navigate ${direction}:`, error);
      return false;
    }
  }

  // タブを再読み込み
  reloadTab(tabId: string): boolean {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    tab.view.webContents.reload();
    return true;
  }

  // タブの情報を取得
  getTabInfo(tabId: string): TabInfo | null {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;

    const currentEntry = tab.history[tab.currentIndex];
    return {
      url: currentEntry.url,
      title: currentEntry.title,
      canGoBack: tab.currentIndex > 0,
      canGoForward: tab.currentIndex < tab.history.length - 1,
    };
  }

  // アクティブなタブを取得
  getActiveTab(): Tab | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) || null;
  }

  // ビューの表示位置とサイズを更新
  updateViewBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    if (!this.activeTabId) return;

    const tab = this.tabs.get(this.activeTabId);
    if (tab) {
      tab.view.setBounds(bounds);
    }
  }

  // すべてのタブとリソースをクリーンアップ
  cleanup(): void {
    Array.from(this.tabs.keys()).forEach((tabId) => this.closeTab(tabId));
  }
}
