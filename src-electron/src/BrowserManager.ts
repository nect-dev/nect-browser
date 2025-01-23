import { BaseWindow, WebContentsView } from 'electron';
import { EventEmitter } from 'events';

interface Tab {
  id: string;
  view: WebContentsView;
  history: string[];
  currentIndex: number;
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

    this.mainWindow.on('resize', () => {
      this.updateActiveViewBounds();
    });
  }

  private updateActiveViewBounds() {
    if (!this.activeTabId) return;

    const [width, height] = this.mainWindow.getSize();
    const view = this.tabs.get(this.activeTabId)?.view;

    if (view) {
      view.setBounds({
        x: 0,
        y: 80,
        width,
        height: height - 80,
      });
    }
  }

  private setupViewEvents(tabId: string, view: WebContentsView) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    view.webContents.on('page-title-updated', (event, title) => {
      this.emit('title-updated', { tabId, title });
    });

    view.webContents.on('did-navigate', (event, url) => {
      this.emit('url-updated', { tabId, url });

      tab.history = tab.history.slice(0, tab.currentIndex + 1);
      tab.history.push(url);
      tab.currentIndex++;
    });

    view.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
      event.preventDefault();
      callback(true);
    });
  }

  createTab(tabId: string, url: string = 'about:blank') {
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    this.tabs.set(tabId, {
      id: tabId,
      view,
      history: [url],
      currentIndex: 0,
    });

    this.setupViewEvents(tabId, view);
    view.webContents.loadURL(url);

    return tabId;
  }

  async switchTab(tabId: string) {
    if (!this.tabs.has(tabId)) return;

    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      this.mainWindow.contentView.removeChildView(this.tabs.get(this.activeTabId)!.view);
    }

    const tab = this.tabs.get(tabId)!;
    this.mainWindow.contentView.addChildView(tab.view);
    this.activeTabId = tabId;
    this.updateActiveViewBounds();

    return {
      url: tab.view.webContents.getURL(),
      title: tab.view.webContents.getTitle(),
    };
  }

  async closeTab(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    if (this.activeTabId === tabId) {
      this.mainWindow.contentView.removeChildView(tab.view);
      this.activeTabId = null;
    }

    tab.view.webContents.close();
    this.tabs.delete(tabId);
  }

  async loadURL(tabId: string, url: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    try {
      await tab.view.webContents.loadURL(url);
    } catch (error) {
      console.error('Error loading URL:', error);
    }
  }

  async navigateHistory(tabId: string, direction: 'back' | 'forward') {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    if (direction === 'back' && tab.currentIndex > 0) {
      tab.currentIndex--;
      await this.loadURL(tabId, tab.history[tab.currentIndex]);
    } else if (direction === 'forward' && tab.currentIndex < tab.history.length - 1) {
      tab.currentIndex++;
      await this.loadURL(tabId, tab.history[tab.currentIndex]);
    }
  }

  async reloadTab(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    tab.view.webContents.reload();
  }

  getTabInfo(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;

    return {
      url: tab.view.webContents.getURL(),
      title: tab.view.webContents.getTitle(),
      canGoBack: tab.currentIndex > 0,
      canGoForward: tab.currentIndex < tab.history.length - 1,
    };
  }
}