import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Globe, ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import { tabsAtom } from "../../store/tabs";

export default function NavigationBar() {
  const [{ activeTabId, tabs }] = useAtom(tabsAtom);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (activeTab) {
      setUrl(activeTab.url);
    }
  }, [activeTabId, tabs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
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
          className="w-8 h-8 flex items-center justify-center text-gray-100 rounded-lg hover:bg-gray-100/10"
          onClick={handleBack}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          className="w-8 h-8 flex items-center justify-center text-gray-100 rounded-lg hover:bg-gray-100/10"
          onClick={handleForward}
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex-1">
        <div className="flex items-center gap-2 px-2 h-8 text-white bg-gray-100/20 rounded-lg">
          <Globe className="w-4 h-4 text-gray-100" />
          <input
            type="text"
            value={url}
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
