// @ts-ignore
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { loadSettings, saveSettings, clearSettings, AppSettings } from './database';

// Network request/response logging for Console
type NetworkLogEntry = {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: any;
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  error?: string;
  duration?: number;
};

const networkLogs: NetworkLogEntry[] = [];
const MAX_LOGS = 100;

function addNetworkLog(log: Omit<NetworkLogEntry, 'id' | 'timestamp'>) {
  const entry: NetworkLogEntry = {
    ...log,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now()
  };
  networkLogs.unshift(entry);
  if (networkLogs.length > MAX_LOGS) {
    networkLogs.pop();
  }
  return entry.id;
}

function updateNetworkLog(id: string, updates: Partial<NetworkLogEntry>) {
  const log = networkLogs.find(l => l.id === id);
  if (log) {
    Object.assign(log, updates);
  }
}

type ScreenshotConfig = {
  viewport?: { width?: number; height?: number };
  selector?: string;
  delayMs?: number;
  mode?: 'sync' | 'async';
};

type ScreenshotInputs = {
  apiKey: string;
  apiBaseUrl?: string;
  url: string;
  config?: ScreenshotConfig;
  headers?: Record<string, string>;
  cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>;
};

function getAppIcon() {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'assets', 'icon512.ico'),
        path.join(process.resourcesPath, 'assets', 'icon512.png'),
        path.join(process.resourcesPath, 'assets', 'icon.png'),
      ]
    : [
        path.join(__dirname, '..', '..', 'assets', 'icon512.ico'),
        path.join(__dirname, '..', '..', 'assets', 'icon512.png'),
        path.join(__dirname, '..', '..', 'assets', 'icon.png'),
      ];
  for (const p of candidates) {
    const exists = fs.existsSync(p);
    console.log(`[icon] checking ${p} -> exists=${exists}`);
    if (exists) {
      const img = nativeImage.createFromPath(p);
      console.log(`[icon] loaded ${p} -> isEmpty=${img.isEmpty()}`);
      if (!img.isEmpty()) return img;
    }
  }
  console.log('[icon] no valid icon found, using default');
  return undefined;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  
  // Create custom menu
  createMenu();
  
  // Open Console window on startup for debugging
  // createConsoleWindow();
}

let consoleWindow: BrowserWindow | null = null;

function createConsoleWindow() {
  if (consoleWindow) {
    consoleWindow.focus();
    return;
  }

  consoleWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'Network Console',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  consoleWindow.loadFile(path.join(__dirname, 'console.html'));

  consoleWindow.on('closed', () => {
    consoleWindow = null;
  });
}

function createMenu() {
  // @ts-ignore
  const template: any[] = [
    {
      label: 'PageOps Screenshot Tool',
      submenu: [
        {
          label: 'Console',
          accelerator: 'F12',
          click: () => {
            createConsoleWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'How to Use',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'How to Use - PageOps Screenshot Tool',
              message: 'Getting Started',
              detail: `Step 1 - Get a Free API Key:
1. Visit https://app.page-ops.com
2. Sign up for a free account
3. Go to API Keys section and create a key
4. Paste the key into the API Key field in this tool

Step 2 - Take a Screenshot:
1. Enter the URL you want to capture
2. Click "Capture" and wait for the result
3. Download the screenshot as PNG or JPEG

How to Copy Cookies from Browser (for authenticated pages):
Chrome/Edge - Console method (Recommended):
1. Press F12 > Console tab
2. Paste: document.cookie.split(';').map(c=>c.trim()).join('\n')
3. Copy the output and paste into the Cookies field

Chrome/Edge - Network method:
1. Press F12 > Network tab > refresh page
2. Click any request > Headers > Cookie
3. Copy the Cookie header value

Cookies JSON format: [{"name":"session","value":"abc123","domain":"example.com"}]
Headers format: {"Authorization": "Bearer xxx"}`,
              buttons: ['OK', 'Get Free API Key']
            }).then(result => {
              if (result.response === 1) {
                require('electron').shell.openExternal('https://app.page-ops.com');
              }
            });
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About',
              message: 'PageOps Screenshot Tool',
              detail: 'Version 0.1.0\n\nA desktop tool for capturing web screenshots using the PageOps Screenshot API.\n\nFree to use — just bring your own API key.\n\nGet a free API key at:\nhttps://app.page-ops.com\n\nBuilt with Electron + React + TypeScript.',
              buttons: ['OK', 'Get Free API Key']
            }).then(result => {
              if (result.response === 1) {
                require('electron').shell.openExternal('https://app.page-ops.com');
              }
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Inline PageOps SDK implementation to avoid module resolution issues
// @ts-ignore
const axios = require('axios');

const PageOpsClient: any = class {
  apiKey: string;
  apiBaseUrl: string;
  client: any;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.apiBaseUrl = 'https://api.page-ops.com/api/v1';
    this.client = axios.create({
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config: any) => {
        const logId = addNetworkLog({
          method: config.method?.toUpperCase() || 'GET',
          url: config.url,
          requestHeaders: { ...config.headers },
          requestBody: config.data
        });
        // Attach logId to config for response interceptor
        config._logId = logId;
        config._startTime = Date.now();
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response: any) => {
        const logId = response.config._logId;
        const duration = Date.now() - (response.config._startTime || 0);
        if (logId) {
          updateNetworkLog(logId, {
            statusCode: response.status,
            responseHeaders: response.headers ? { ...response.headers } : {},
            responseBody: response.data,
            duration
          });
        }
        return response;
      },
      (error: any) => {
        const logId = error.config?._logId;
        const duration = Date.now() - (error.config?._startTime || 0);
        if (logId) {
          updateNetworkLog(logId, {
            statusCode: error.response?.status,
            responseHeaders: error.response?.headers ? { ...error.response.headers } : {},
            responseBody: error.response?.data,
            error: error.message,
            duration
          });
        }
        return Promise.reject(error);
      }
    );
  }

  async createScreenshot(request: any) {
    const url = `${this.apiBaseUrl}/screenshots`;
    const response = await this.client.post(url, request);
    return response.data;
  }

  async getScreenshotStatus(jobId: string) {
    const url = `${this.apiBaseUrl}/screenshots/${jobId}`;
    const response = await this.client.get(url);
    return response.data;
  }
};

const ScreenshotRequest: any = class {
  url: string;
  mode: string;
  timeoutMs?: number;
  fullPage: boolean;
  viewport?: any;
  format?: string;
  quality?: number;
  waitUntil?: string;
  delayMs?: number;
  selector?: string;
  headers?: any;
  cookies?: any;
  javascript?: string;
  css?: string;
  device?: string;
  strictDevice?: boolean;
  colorScheme?: string;
  proxy?: any;
  trace?: boolean;
  har?: boolean;
  returnDom?: boolean;
  returnNetwork?: boolean;
  priority?: string;

  constructor(url: string, options: any = {}) {
    this.url = url;
    this.mode = options.mode || 'async';
    this.timeoutMs = options.timeoutMs;
    this.fullPage = options.fullPage || false;
    this.viewport = options.viewport;
    this.format = options.format;
    this.quality = options.quality;
    this.waitUntil = options.waitUntil;
    this.delayMs = options.delayMs;
    this.selector = options.selector;
    this.headers = options.headers;
    this.cookies = options.cookies;
    this.javascript = options.javascript;
    this.css = options.css;
    this.device = options.device;
    this.strictDevice = options.strictDevice;
    this.colorScheme = options.colorScheme;
    this.proxy = options.proxy;
    this.trace = options.trace;
    this.har = options.har;
    this.returnDom = options.returnDom;
    this.returnNetwork = options.returnNetwork;
    this.priority = options.priority;
  }
};

async function createScreenshot(inputs: ScreenshotInputs) {

  const client = new PageOpsClient(inputs.apiKey);
  if (inputs.apiBaseUrl) {
    client.apiBaseUrl = inputs.apiBaseUrl.replace(/\/+$/, '');
  }

  const requestPayload: any = {
    ...(inputs.config ?? {}),
    headers: inputs.headers,
    cookies: inputs.cookies
  };

  const request = new ScreenshotRequest(inputs.url, requestPayload);
  return client.createScreenshot(request);
}

async function getScreenshotStatus(apiKey: string, apiBaseUrl: string | undefined, jobId: string) {
  const client = new PageOpsClient(apiKey);
  if (apiBaseUrl) {
    client.apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
  }
  return client.getScreenshotStatus(jobId);
}

async function downloadImageToFile(url: string, targetPath: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(targetPath, buf);
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('pageops:createScreenshot', async (_evt: any, inputs: ScreenshotInputs) => {
    try {
      return { ok: true, data: await createScreenshot(inputs) };
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : String(e);
      const status = e?.response?.status;
      const body = e?.response?.data;
      return { ok: false, error: { message, status, body } };
    }
  });

  ipcMain.handle(
    'pageops:getScreenshotStatus',
    async (_evt: any, args: { apiKey: string; apiBaseUrl?: string; jobId: string }) => {
      try {
        return { ok: true, data: await getScreenshotStatus(args.apiKey, args.apiBaseUrl, args.jobId) };
      } catch (e: any) {
        const message = typeof e?.message === 'string' ? e.message : String(e);
        const status = e?.response?.status;
        const body = e?.response?.data;
        return { ok: false, error: { message, status, body } };
      }
    }
  );

  ipcMain.handle('pageops:downloadImage', async (_evt: any, args: { url: string; suggestedName: string }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: args.suggestedName,
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
      ]
    });

    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    try {
      await downloadImageToFile(args.url, filePath);
      return { ok: true, filePath };
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : String(e);
      return { ok: false, error: { message } };
    }
  });

  // Console IPC handlers
  ipcMain.handle('console:openWindow', () => {
    createConsoleWindow();
    return { ok: true };
  });

  ipcMain.handle('console:getLogs', () => {
    return { ok: true, data: networkLogs };
  });

  ipcMain.handle('console:clearLogs', () => {
    networkLogs.length = 0;
    return { ok: true };
  });

  ipcMain.handle('console:exportLogs', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `pageops-logs-${Date.now()}.json`,
      filters: [
        { name: 'JSON', extensions: ['json'] }
      ]
    });

    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    try {
      const content = JSON.stringify(networkLogs, null, 2);
      await fs.promises.writeFile(filePath, content, 'utf-8');
      return { ok: true, filePath };
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : String(e);
      return { ok: false, error: { message } };
    }
  });

  // Settings IPC handlers
  ipcMain.handle('settings:load', () => {
    try {
      const settings = loadSettings();
      return { ok: true, data: settings };
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : String(e);
      return { ok: false, error: { message } };
    }
  });

  ipcMain.handle('settings:save', (_: any, settings: Partial<AppSettings>) => {
    try {
      saveSettings(settings);
      return { ok: true };
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : String(e);
      return { ok: false, error: { message } };
    }
  });

  ipcMain.handle('settings:clear', () => {
    try {
      clearSettings();
      return { ok: true };
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : String(e);
      return { ok: false, error: { message } };
    }
  });

  ipcMain.handle('shell:openExternal', (_: any, url: string) => {
    shell.openExternal(url);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
