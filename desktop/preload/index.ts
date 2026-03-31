import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("mediaforgeDesktop", {
  platform: process.platform,
  runtime: "electron-shell",
});
