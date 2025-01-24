import React, { useEffect } from "react";
import { Plus, X } from "lucide-react";
import { useAtom } from "jotai";
import { tabsAtom } from "../../store/tabs";

export default function TabList() {
  const [{ tabs, activeTabId }, setTabState] = useAtom(tabsAtom);

  useEffect(() => {
    // タブが作成された時のイベントハンドラ
    const handleTabCreated = (_: any, data: { tabId: string; url: string; title: string }) => {
      setTabState((prev) => ({
        tabs: [
          ...prev.tabs,
          {
            id: data.tabId,
            url: data.url,
            title: data.title || "New Tab",
          },
        ],
        activeTabId: data.tabId,
      }));
    };

    // タブが切り替わった時のイベントハンドラ
    const handleTabSwitched = (_: any, data: { tabId: string; url: string; title: string }) => {
      setTabState((prev) => ({
        ...prev,
        tabs: prev.tabs.map((tab) =>
          tab.id === data.tabId ? { ...tab, url: data.url, title: data.title || tab.title } : tab
        ),
        activeTabId: data.tabId,
      }));
    };

    // タイトルが変更された時のイベントハンドラ
    const handleTitleChanged = (_: any, data: { tabId: string; title: string }) => {
      setTabState((prev) => ({
        ...prev,
        tabs: prev.tabs.map((tab) => (tab.id === data.tabId ? { ...tab, title: data.title } : tab)),
      }));
    };

    // URLが変更された時のイベントハンドラ
    const handleUrlChanged = (_: any, data: { tabId: string; url: string }) => {
      setTabState((prev) => ({
        ...prev,
        tabs: prev.tabs.map((tab) => (tab.id === data.tabId ? { ...tab, url: data.url } : tab)),
      }));
    };

    // タブが閉じられた時のイベントハンドラ
    const handleTabClosed = (_: any, data: { tabId: string }) => {
      setTabState((prev) => {
        const newTabs = prev.tabs.filter((tab) => tab.id !== data.tabId);
        return {
          tabs: newTabs,
          // もし閉じたタブがアクティブだった場合、最後のタブをアクティブにする
          activeTabId:
            prev.activeTabId === data.tabId ? newTabs[newTabs.length - 1]?.id : prev.activeTabId,
        };
      });
    };

    // イベントリスナーの登録
    window.electron.ipcRenderer.on("tab-created", handleTabCreated);
    window.electron.ipcRenderer.on("tab-switched", handleTabSwitched);
    window.electron.ipcRenderer.on("title-changed", handleTitleChanged);
    window.electron.ipcRenderer.on("url-changed", handleUrlChanged);
    window.electron.ipcRenderer.on("tab-closed", handleTabClosed);

    return () => {
      // クリーンアップ
      window.electron.ipcRenderer.removeListener("tab-created", handleTabCreated);
      window.electron.ipcRenderer.removeListener("tab-switched", handleTabSwitched);
      window.electron.ipcRenderer.removeListener("title-changed", handleTitleChanged);
      window.electron.ipcRenderer.removeListener("url-changed", handleUrlChanged);
      window.electron.ipcRenderer.removeListener("tab-closed", handleTabClosed);
    };
  }, [setTabState]); // setTabStateを依存配列に追加

  const addTab = () => {
    const newId = `tab-${crypto.randomUUID()}`;
    window.electron.ipcRenderer.send("create-tab", {
      tabId: newId,
      url: "about:blank",
    });
  };

  const switchTab = (tabId: string) => {
    if (tabId === activeTabId) return;
    window.electron.ipcRenderer.send("switch-tab", { tabId });
  };

  const closeTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();

    if (tabs.length === 1) {
      // 最後のタブを閉じる場合は新しいタブを作成してから閉じる
      const newId = `tab-${crypto.randomUUID()}`;
      window.electron.ipcRenderer.send("create-tab", {
        tabId: newId,
        url: "about:blank",
      });
    }

    window.electron.ipcRenderer.send("close-tab", { tabId });
  };

  return (
    <div className="flex flex-1 items-center">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => switchTab(tab.id)}
          className={`
            group relative flex flex-1 items-center justify-between
            min-w-0 max-w-xs px-1 h-8 cursor-pointer
            transition-colors duration-200 border-x border-gray-100/10
            ${activeTabId === tab.id ? "bg-gray-100/10 rounded-t-lg" : "hover:bg-gray-100/5"}
          `}
        >
          <span className="px-2 text-xs font-medium truncate text-white">
            {tab.title || tab.url || "New Tab"}
          </span>
          {(activeTabId === tab.id || tabs.length > 1) && (
            <button
              onClick={(e) => closeTab(e, tab.id)}
              className={`
                p-1.5 text-gray-100 hover:bg-gray-100/10 rounded-lg
                ${activeTabId === tab.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
              `}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={addTab}
        className="p-1.5 m-1 mr-10 flex items-center text-gray-100 hover:bg-gray-100/10 rounded-lg"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}
