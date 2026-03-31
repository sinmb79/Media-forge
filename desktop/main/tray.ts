import { Menu, Tray, nativeImage } from "electron";

export function createAppTray(input: {
  onOpen: () => void;
  onQuit: () => void;
}): Tray {
  const tray = new Tray(nativeImage.createEmpty());

  tray.setToolTip("MediaForge");
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      click: input.onOpen,
      label: "Open MediaForge",
    },
    {
      type: "separator",
    },
    {
      click: input.onQuit,
      label: "Quit",
    },
  ]));

  tray.on("double-click", input.onOpen);
  return tray;
}
