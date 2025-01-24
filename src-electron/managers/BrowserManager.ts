import { BaseWindow, WebContentsView } from "electron";
import { EventEmitter } from "events";

// タブの情報を格納するインターフェース
interface Tab {
  id: string; // タブの一意識別子
  view: WebContentsView; // Webページの表示・制御用コンポーネント
  history: string[]; // 閲覧履歴のURL配列
  currentIndex: number; // 現在の履歴位置
  cleanup: () => void; // リソース解放用の関数
}

// タブの情報を返すインターフェース
interface TabInfo {
  url: string; // 現在のURL
  title: string; // ページタイトル
  canGoBack: boolean; // 戻るボタンの有効状態
  canGoForward: boolean; // 進むボタンの有効状態
}

// ブラウザのタブ管理を行うクラス
export class BrowserManager extends EventEmitter {
  private mainWindow: BaseWindow;
  private tabs: Map<string, Tab>;
  private activeTabId: string | null;

  constructor(mainWindow: BaseWindow) {
    super();
    this.mainWindow = mainWindow;
    this.tabs = new Map();
    this.activeTabId = null;

    // ウィンドウリサイズ時のイベントハンドラを設定
    const resizeHandler = () => this.updateActiveViewBounds();
    this.mainWindow.on("resize", resizeHandler);

    // インスタンス破棄時のクリーンアップ処理
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

  // タブのWebContentsに対するイベントリスナーを設定
  private setupViewEvents(tabId: string, view: WebContentsView): () => void {
    const tab = this.tabs.get(tabId);
    if (!tab) return () => {};

    // タイトル更新時のイベントハンドラ
    const titleHandler = (_: Event, title: string) => {
      this.emit("title-updated", { tabId, title });
    };

    // ページ遷移完了時のイベントハンドラ
    const navigationHandler = async (_: Event, url: string) => {
      // 履歴を更新
      tab.history = tab.history.slice(0, tab.currentIndex + 1);
      tab.history.push(url);
      tab.currentIndex++;

      // URL更新を通知
      this.emit("url-updated", { tabId, url });

      // ページ読み込み完了後にタイトルを取得して通知
      const title = view.webContents.getTitle();
      this.emit("title-updated", { tabId, title: title || url });
    };

    // イベントリスナーを登録
    view.webContents.on("page-title-updated", titleHandler);
    view.webContents.on("did-navigate", navigationHandler);

    // クリーンアップ関数を返す
    return () => {
      view.webContents.removeListener("page-title-updated", titleHandler);
      view.webContents.removeListener("did-navigate", navigationHandler);
    };
  }

  // 新しいタブを作成
  createTab(tabId: string, url: string = "about:blank"): string {
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false, // セキュリティのためNode.js統合を無効化
        contextIsolation: true, // レンダラープロセスを分離
        sandbox: true, // サンドボックス化を有効化
      },
    });

    const cleanup = this.setupViewEvents(tabId, view);

    this.tabs.set(tabId, {
      id: tabId,
      view,
      history: [url],
      currentIndex: 0,
      cleanup,
    });

    view.webContents.loadURL(url);
    return tabId;
  }

  // 指定したタブに切り替え
  switchTab(tabId: string): TabInfo | null {
    if (!this.tabs.has(tabId)) return null;

    // 現在のアクティブタブを非表示
    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      this.mainWindow.contentView.removeChildView(this.tabs.get(this.activeTabId)!.view);
    }

    // 新しいタブを表示
    const tab = this.tabs.get(tabId)!;
    this.mainWindow.contentView.addChildView(tab.view);
    this.activeTabId = tabId;
    this.updateActiveViewBounds();

    return {
      url: tab.view.webContents.getURL(),
      title: tab.view.webContents.getTitle(),
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

    tab.cleanup(); // イベントリスナーを解除
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
      this.emit("load-error", { tabId, url, error });
      return false;
    }
  }

  // タブの履歴を前後に移動
  async navigateHistory(tabId: string, direction: "back" | "forward"): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    if (direction === "back" && tab.currentIndex > 0) {
      tab.currentIndex--;
      return this.loadURL(tabId, tab.history[tab.currentIndex]);
    } else if (direction === "forward" && tab.currentIndex < tab.history.length - 1) {
      tab.currentIndex++;
      return this.loadURL(tabId, tab.history[tab.currentIndex]);
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
      canGoBack: tab.currentIndex > 0,
      canGoForward: tab.currentIndex < tab.history.length - 1,
    };
  }

  // アクティブなタブの情報を取得
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
