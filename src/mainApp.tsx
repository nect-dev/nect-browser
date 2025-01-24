import { Minus, Maximize2, PanelLeft, Share, Ellipsis, X } from "lucide-react";
import NavigationBar from "@/components/main/NavigationBar";
import TabList from "@/components/main/TabList";

export default function MainApp() {
  const handleWindowControls = {
    minimize: () => window.electron.ipcRenderer?.send("window-control", "minimize"),
    maximize: () => window.electron.ipcRenderer?.send("window-control", "maximize"),
    close: () => window.electron.ipcRenderer?.send("window-control", "close"),
  };

  const toggleSidebar = () => {
    window.electron.ipcRenderer.send("toggle-sidebar");
  };

  return (
    <div className="h-screen relative flex flex-col select-none">
      <img
        src="assets/wallpapers/default.jpg"
        className="w-full h-full inset-0 absolute object-cover object-center -z-10"
        alt="Background"
      />
      <div className="flex flex-col backdrop-blur-lg bg-gray-900/50">
        <div className="h-8 flex" onDoubleClick={handleWindowControls.maximize}>
          <TabList />
          <div className="flex items-center">
            <button
              onClick={handleWindowControls.minimize}
              className="p-1.5 m-1 flex items-center justify-center text-gray-100 hover:bg-gray-100/10 rounded-lg"
            >
              <Minus size={12} />
            </button>
            <button
              onClick={handleWindowControls.maximize}
              className="p-1.5 m-1 flex items-center justify-center text-gray-100 hover:bg-gray-100/10 rounded-lg"
            >
              <Maximize2 size={12} />
            </button>
            <button
              onClick={handleWindowControls.close}
              className="p-1.5 m-1 flex items-center justify-center text-gray-100 hover:bg-red-500 rounded-lg"
            >
              <X size={12} />
            </button>
          </div>
        </div>
        <div className="h-12 flex items-center bg-gray-100/10">
          <button
            onClick={toggleSidebar}
            className="w-8 h-8 mx-2 flex items-center justify-center text-gray-100 rounded-lg hover:bg-gray-100/10"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <NavigationBar />
          <div className="flex gap-1 mx-2">
            <button className="w-8 h-8 flex items-center justify-center text-gray-100 rounded-lg hover:bg-gray-100/10">
              <Share className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 flex items-center justify-center text-gray-100 rounded-lg hover:bg-gray-100/10">
              <Ellipsis className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
