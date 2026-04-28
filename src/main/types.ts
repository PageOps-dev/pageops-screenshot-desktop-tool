export type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  position: WatermarkPosition;
  fontSize: number;
  opacity: number;
  color: string;
  backgroundColor: string;
  padding: number;
}

export type PosterTemplateId = 'instagram-product' | 'instagram-story' | 'facebook-ad' | 'twitter-card' | 'trust-badge';
export type PosterBackgroundStyle = 'gradient' | 'solid' | 'dark';

export interface PosterConfig {
  templateId: PosterTemplateId;
  title?: string;
  subtitle?: string;
  price?: string;
  badge?: string;
  showUrl: boolean;
  showTimestamp: boolean;
  showDeviceInfo: boolean;
  showBrand: boolean;
  brandText: string;
  accentColor: string;
  backgroundStyle: PosterBackgroundStyle;
}

export interface PresetConfig {
  name: string;
  viewportW: string;
  viewportH: string;
  mode: 'async' | 'sync';
  headersJson: string;
  cookiesJson: string;
}

export interface AppSettings {
  apiKey: string;
  apiBaseUrl: string;
  targetUrl: string;
  mode: 'async' | 'sync';
  viewportW: string;
  viewportH: string;
  selector: string;
  headersJson: string;
  cookiesJson: string;
  watermark?: WatermarkConfig;
  posterConfig?: PosterConfig;
  presets?: PresetConfig[];
}
