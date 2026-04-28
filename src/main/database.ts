import path from 'path';
import os from 'os';
import fs from 'fs';
import type { AppSettings, WatermarkConfig, PosterConfig, PresetConfig } from './types';

export type { AppSettings, WatermarkConfig, PosterConfig, PresetConfig };

const dataDir = path.join(os.homedir(), '.pageops-screenshot-tool');
const settingsFile = path.join(dataDir, 'settings.json');

// Ensure directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const defaultSettings: AppSettings = {
  apiKey: '',
  apiBaseUrl: 'https://api.page-ops.com/api/v1',
  targetUrl: '',
  mode: 'async',
  viewportW: '',
  viewportH: '',
  selector: '',
  headersJson: '',
  cookiesJson: '',
  presets: []
};

export function loadSettings(): AppSettings {
  try {
    if (!fs.existsSync(settingsFile)) {
      return { ...defaultSettings };
    }
    const content = fs.readFileSync(settingsFile, 'utf-8');
    const parsed = JSON.parse(content) as Partial<AppSettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: Partial<AppSettings>): void {
  const current = loadSettings();
  const merged = { ...current, ...settings };
  fs.writeFileSync(settingsFile, JSON.stringify(merged, null, 2), 'utf-8');
}

export function clearSettings(): void {
  try {
    if (fs.existsSync(settingsFile)) {
      fs.unlinkSync(settingsFile);
    }
  } catch {
    // Ignore errors
  }
}
