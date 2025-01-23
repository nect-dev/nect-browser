export interface Tab {
  id: string;
  url: string;
  title: string;
}

export interface TabState {
  tabs: Tab[];
  activeTabId: string;
}