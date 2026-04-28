// @ts-ignore
import { contextBridge, ipcRenderer } from 'electron';
import type { WatermarkConfig, WatermarkPosition, PosterConfig, PosterTemplateId, PosterBackgroundStyle, PresetConfig, AppSettings } from './types';

export type { WatermarkConfig, WatermarkPosition, PosterConfig, PosterTemplateId, PosterBackgroundStyle, PresetConfig, AppSettings };

export type ScreenshotConfig = {
  viewport?: { width?: number; height?: number };
  selector?: string;
  delayMs?: number;
  mode?: 'sync' | 'async';
  fullPage?: boolean;
};

export type ScreenshotInputs = {
  apiKey: string;
  apiBaseUrl?: string;
  url: string;
  config?: ScreenshotConfig;
  headers?: Record<string, string>;
  cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>;
};

export type IpcOk<T> = { ok: true; data: T };
export type IpcErr = { ok: false; error?: { message: string; status?: number; body?: any }; canceled?: boolean };


const api = {
  createScreenshot: (inputs: ScreenshotInputs) => ipcRenderer.invoke('pageops:createScreenshot', inputs) as Promise<IpcOk<any> | IpcErr>,
  getScreenshotStatus: (args: { apiKey: string; apiBaseUrl?: string; jobId: string }) =>
    ipcRenderer.invoke('pageops:getScreenshotStatus', args) as Promise<IpcOk<any> | IpcErr>,
  downloadImage: (args: { url: string; suggestedName: string }) =>
    ipcRenderer.invoke('pageops:downloadImage', args) as Promise<{ ok: true; filePath: string } | IpcErr>,
  console: {
    openWindow: () => ipcRenderer.invoke('console:openWindow') as Promise<IpcOk<null> | IpcErr>,
    getLogs: () => ipcRenderer.invoke('console:getLogs') as Promise<IpcOk<any[]> | IpcErr>,
    clearLogs: () => ipcRenderer.invoke('console:clearLogs') as Promise<IpcOk<null> | IpcErr>,
    exportLogs: () => ipcRenderer.invoke('console:exportLogs') as Promise<{ ok: true; filePath: string } | IpcErr>
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load') as Promise<IpcOk<AppSettings> | IpcErr>,
    save: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:save', settings) as Promise<IpcOk<null> | IpcErr>,
    clear: () => ipcRenderer.invoke('settings:clear') as Promise<IpcOk<null> | IpcErr>
  },
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>
};

contextBridge.exposeInMainWorld('pageops', api);

export type PageOpsBridge = typeof api;
