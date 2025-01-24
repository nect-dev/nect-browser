import { WebContentsView, app } from "electron";
import * as path from "path";
import { EventEmitter } from "events";

export interface SidebarBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class SidebarManager extends EventEmitter {
  private view: WebContentsView;
  private isVisible: boolean = false;
  private readonly UI_HEIGHT: number;

  constructor(uiHeight: number) {
    super();
    this.UI_HEIGHT = uiHeight;
    this.view = this.createView();
  }

  // サイドバービューを作成
  private createView(): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    if (!app.isPackaged) {
      view.webContents.loadURL('http://localhost:5173/sidebar.html');
    } else {
      view.webContents.loadFile(path.join(__dirname, '../src/sidebar.html'));
    }

    view.setVisible(false);
    return view;
  }

  // サイドバーの表示状態を切り替え
  public toggle(bounds: SidebarBounds): void {
    this.isVisible = !this.isVisible;
    this.view.setVisible(this.isVisible);
    
    if (this.isVisible) {
      this.updateBounds(bounds);
    }
    
    this.emit("visibility-changed", this.isVisible);
  }

  // サイドバーの位置とサイズを更新
  public updateBounds(bounds: SidebarBounds): void {
    if (this.isVisible) {
      this.view.setBounds(bounds);
    }
  }

  // サイドバービューを取得
  public getView(): WebContentsView {
    return this.view;
  }

  // サイドバーの表示状態を取得
  public getVisibility(): boolean {
    return this.isVisible;
  }
}