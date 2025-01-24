import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import MainApp from "./mainApp";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MainApp />
  </React.StrictMode>
);
