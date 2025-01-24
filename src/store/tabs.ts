import { atom } from "jotai";
import { Tab, TabState } from "../types/tabs";

const initialTab: Tab = { id: "tab-1", url: "about:blank", title: "New Tab" };

export const tabsAtom = atom<TabState>({
  tabs: [initialTab],
  activeTabId: "tab-1",
});
