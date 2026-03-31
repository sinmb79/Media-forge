declare module "electron" {
  export interface BrowserWindowConstructorOptions {
    backgroundColor?: string;
    height?: number;
    minHeight?: number;
    minWidth?: number;
    show?: boolean;
    title?: string;
    webPreferences?: {
      preload?: string;
    };
    width?: number;
  }

  export class BrowserWindow {
    constructor(options?: BrowserWindowConstructorOptions);
    isVisible(): boolean;
    loadFile(filePath: string): Promise<void>;
    loadURL(url: string): Promise<void>;
    once(event: string, listener: () => void): this;
    show(): void;
  }

  export interface MenuItemConstructorOptions {
    click?: () => void;
    label?: string;
    type?: "separator";
  }

  export class Menu {
    static buildFromTemplate(template: MenuItemConstructorOptions[]): Menu;
  }

  export class Tray {
    constructor(image?: unknown);
    on(event: string, listener: () => void): this;
    setContextMenu(menu: Menu): void;
    setToolTip(text: string): void;
  }

  export const nativeImage: {
    createEmpty(): unknown;
  };

  export const app: {
    isPackaged: boolean;
    on(event: string, listener: () => void | Promise<void>): void;
    quit(): void;
    whenReady(): Promise<void>;
  };

  export const contextBridge: {
    exposeInMainWorld(key: string, api: unknown): void;
  };
}
