import { House, EyeOff, Star, History, ArrowDownToLine } from "lucide-react";

export default function SidebarApp() {
  return (
    <div className="h-screen flex flex-col bg-gray-900/50 backdrop-blur-lg text-gray-100">
      <nav className="flex-1">
        <div className="p-2">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100/10 transition-colors">
            <House className="w-4 h-4" />
            <span className="text-sm font-medium">メインページ</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100/10 transition-colors">
            <EyeOff className="w-4 h-4" />
            <span className="text-sm font-medium">シークレット</span>
          </button>
        </div>
        <div className="p-2">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100/10 transition-colors">
            <Star className="w-4 h-4" />
            <span className="text-sm font-medium">お気に入り</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100/10 transition-colors">
            <History className="w-4 h-4" />
            <span className="text-sm font-medium">履歴</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100/10 transition-colors">
            <ArrowDownToLine className="w-4 h-4" />
            <span className="text-sm font-medium">ダウンロード</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
