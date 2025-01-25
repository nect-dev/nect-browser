import { BaseWindow, WebContentsView } from "electron";
import { EventEmitter } from "events";
import { SidebarManager } from "./SidebarManager";

// タブの情報を格納するインターフェース
interface Tab {
  id: string;
  view: WebContentsView;
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

  constructor(
    mainWindow: BaseWindow,
    private readonly sidebarManager: SidebarManager,
    private readonly headerHeight: number,
    private readonly sidebarWidth: number
  ) {
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

  private emitNavigationState(tabId: string, view: WebContentsView): void {
    this.emit("navigation-state-changed", {
      tabId,
      canGoBack: view.webContents.navigationHistory.canGoBack(),
      canGoForward: view.webContents.navigationHistory.canGoForward(),
    });
  }

  private setupViewEvents(tabId: string, view: WebContentsView): () => void {
    const titleHandler = (_: Event, title: string) => {
      this.emit("title-updated", { tabId, title });
    };

    const navigationHandler = () => {
      const url = view.webContents.getURL();
      const title = view.webContents.getTitle();
      this.emit("url-updated", { tabId, url });
      this.emit("title-updated", { tabId, title });
      this.emitNavigationState(tabId, view);
    };

    const loadStartHandler = () => {
      const url = view.webContents.getURL();
      this.emit("url-updated", { tabId, url });
    };

    view.webContents.on("page-title-updated", titleHandler);
    view.webContents.on("did-navigate", navigationHandler);
    view.webContents.on("did-navigate-in-page", navigationHandler);
    view.webContents.on("did-start-loading", loadStartHandler);

    return () => {
      view.webContents.removeListener("page-title-updated", titleHandler);
      view.webContents.removeListener("did-navigate", navigationHandler);
      view.webContents.removeListener("did-navigate-in-page", navigationHandler);
      view.webContents.removeListener("did-start-loading", loadStartHandler);
    };
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

    const cleanup = this.setupViewEvents(tabId, view);
    this.tabs.set(tabId, { id: tabId, view, cleanup });
    view.webContents.loadURL(url);

    return tabId;
  }

  // ブラウザビューの位置とサイズを計算
  private calculateBrowserViewBounds(): { x: number; y: number; width: number; height: number } {
    const [width, height] = this.mainWindow.getSize();
    const isSidebarVisible = this.sidebarManager.getVisibility();

    return {
      x: isSidebarVisible ? this.sidebarWidth : 0,
      y: this.headerHeight,
      width: width - (isSidebarVisible ? this.sidebarWidth : 0),
      height: height - this.headerHeight,
    };
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

    // サイドバーの状態を考慮してビューの位置とサイズを更新
    const bounds = this.calculateBrowserViewBounds();
    tab.view.setBounds(bounds);

    return {
      url: tab.view.webContents.getURL(),
      title: tab.view.webContents.getTitle(),
      canGoBack: tab.view.webContents.canGoBack(),
      canGoForward: tab.view.webContents.canGoForward(),
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

    if (direction === "back" && tab.view.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.navigationHistory.goBack();
      return true;
    } else if (direction === "forward" && tab.view.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.navigationHistory.goForward();
      return true;
    }
    return false;
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

    return {
      url: tab.view.webContents.getURL(),
      title: tab.view.webContents.getTitle(),
      canGoBack: tab.view.webContents.navigationHistory.canGoBack(),
      canGoForward: tab.view.webContents.navigationHistory.canGoForward(),
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
