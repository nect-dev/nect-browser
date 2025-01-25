import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Globe, ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import { tabsAtom } from "../../store/tabs";

export default function NavigationBar() {
  const [{ activeTabId, tabs }] = useAtom(tabsAtom);
  const [url, setUrl] = useState("");
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (activeTab) {
      try {
        const urlObj = new URL(activeTab.url);
        if (urlObj.hostname === "www.google.com" && urlObj.pathname === "/search") {
          const searchQuery = urlObj.searchParams.get("q");
          setUrl(searchQuery || activeTab.url);
        } else {
          setUrl(activeTab.url);
        }
      } catch {
        setUrl(activeTab.url);
      }
    }

    const handleNavigationState = (
      _: any,
      data: {
        tabId: string;
        canGoBack: boolean;
        canGoForward: boolean;
      }
    ) => {
      if (data.tabId === activeTabId) {
        setCanGoBack(data.canGoBack);
        setCanGoForward(data.canGoForward);
      }
    };

    const cleanup = window.electron.ipcRenderer.on(
      "navigation-state-changed",
      handleNavigationState
    );

    return cleanup;
  }, [activeTabId, tabs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let fullUrl: string;

    const trimmedUrl = url.trim();
    if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
      fullUrl = trimmedUrl;
    } else {
      if (
        // ドメイン
        /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(trimmedUrl) ||
        // localhost
        trimmedUrl === "localhost" ||
        // IPアドレス
        /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(trimmedUrl)
      ) {
        fullUrl = `https://${trimmedUrl}`;
      } else {
        // 検索クエリとして扱う
        const searchQuery = encodeURIComponent(trimmedUrl);
        fullUrl = `https://www.google.com/search?q=${searchQuery}`;
      }
    }

    window.electron.ipcRenderer.send("load-url", { url: fullUrl, tabId: activeTabId });
  };

  const handleBack = () => {
    window.electron.ipcRenderer.send("navigate-history", { tabId: activeTabId, direction: "back" });
  };

  const handleForward = () => {
    window.electron.ipcRenderer.send("navigate-history", {
      tabId: activeTabId,
      direction: "forward",
    });
  };

  const handleReload = () => {
    window.electron.ipcRenderer.send("reload-tab", { tabId: activeTabId });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <div className="flex items-center gap-2 w-full max-w-2xl mx-auto">
      <div className="flex gap-1">
        <button
          className={`w-8 h-8 flex items-center justify-center rounded-lg 
            ${
              canGoBack ? "text-gray-100 hover:bg-gray-100/10" : "text-gray-500 cursor-not-allowed"
            }`}
          onClick={handleBack}
          disabled={!canGoBack}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          className={`w-8 h-8 flex items-center justify-center rounded-lg 
            ${
              canGoForward
                ? "text-gray-100 hover:bg-gray-100/10"
                : "text-gray-500 cursor-not-allowed"
            }`}
          onClick={handleForward}
          disabled={!canGoForward}
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex-1">
        <div className="flex items-center gap-2 px-2 h-8 text-white bg-gray-100/20 rounded-lg">
          <Globe className="w-4 h-4 text-gray-100" />
          <input
            type="text"
            value={decodeURIComponent(url)}
            onChange={handleUrlChange}
            onFocus={handleFocus}
            placeholder="検索またはURLを入力"
            className="flex-1 bg-transparent border-none outline-none text-sm"
          />
        </div>
      </form>
      <button
        className="w-8 h-8 flex items-center justify-center text-gray-100 rounded-lg hover:bg-gray-100/10"
        onClick={handleReload}
      >
        <RotateCw className="w-4 h-4" />
      </button>
    </div>
  );
}
