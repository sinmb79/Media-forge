import { app } from "electron";
import { fileURLToPath } from "node:url";

import { DesktopBackendManager } from "./backend-manager.js";
import { createAppTray } from "./tray.js";
import { createMainWindow } from "./window.js";

let runtimeManager: DesktopBackendManager | null = null;
let mainWindow = null as ReturnType<typeof createMainWindow> | null;

async function bootDesktopApp(): Promise<void> {
  runtimeManager = new DesktopBackendManager();
  const window = createMainWindow();
  mainWindow = window;

  const openDashboard = async (): Promise<void> => {
    const dashboardUrl = await runtimeManager!.startDashboardRuntime();
    await window.loadURL(dashboardUrl);
  };

  createAppTray({
    onOpen: () => {
      if (!window.isVisible()) {
        window.show();
      }

      void openDashboard();
    },
    onQuit: () => {
      app.quit();
    },
  });

  window.loadFile(fileURLToPath(new URL("../resources/splash.html", import.meta.url)));
  void openDashboard();
}

app.whenReady().then(() => {
  void bootDesktopApp();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  await runtimeManager?.stopDashboardRuntime();
});
