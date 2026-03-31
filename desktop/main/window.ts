import { BrowserWindow } from "electron";
import * as path from "node:path";

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    backgroundColor: "#07070b",
    height: 980,
    minHeight: 720,
    minWidth: 1200,
    show: false,
    title: "MediaForge",
    webPreferences: {
      preload: path.join(import.meta.dirname, "..", "preload", "index.js"),
    },
    width: 1560,
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  return window;
}
