export type PosterTemplateId = 'instagram-product' | 'instagram-story' | 'facebook-ad' | 'twitter-card' | 'trust-badge';

export type PosterTemplate = {
  id: PosterTemplateId;
  name: string;
  width: number;
  height: number;
  category: 'social' | 'showcase' | 'comparison';
};

export const posterTemplates: PosterTemplate[] = [
    { id: 'instagram-product', name: 'Instagram Product Showcase', width: 1080, height: 1350, category: 'social' },
    { id: 'instagram-story', name: 'Instagram/TikTok Story', width: 1080, height: 1920, category: 'social' },
    { id: 'facebook-ad', name: 'Facebook Ad', width: 1200, height: 628, category: 'social' },
    { id: 'twitter-card', name: 'Twitter/X Card', width: 1200, height: 675, category: 'social' },
    { id: 'trust-badge', name: 'Trust Badge', width: 800, height: 800, category: 'showcase' },
];

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

export const defaultPosterConfig: PosterConfig = {
  templateId: 'instagram-product',
  title: '',
  subtitle: '',
  price: '',
  badge: '',
  showUrl: true,
  showTimestamp: true,
  showDeviceInfo: true,
  showBrand: true,
  brandText: 'Captured by PageOps',
  accentColor: '#6366f1',
  backgroundStyle: 'gradient',
};

interface ScreenshotMetadata {
  url: string;
  viewport?: { width?: number; height?: number };
  timestamp: number;
}

export async function generatePoster(
  imageUrl: string,
  config: PosterConfig,
  metadata: ScreenshotMetadata
): Promise<Blob> {
  const template = posterTemplates.find(t => t.id === config.templateId);
  if (!template) throw new Error('Template not found');

  const canvas = document.createElement('canvas');
  canvas.width = template.width;
  canvas.height = template.height;
  const ctx = canvas.getContext('2d')!;

  // Draw background
  drawBackground(ctx, template, config);

  // Draw screenshot with frame
  const { bottomY: screenshotBottomY, isFullBleed } = await drawScreenshot(ctx, imageUrl, template, config);

  if (template.id === 'twitter-card' || template.id === 'facebook-ad') {
    // Horizontal: always overlay
    drawHorizontalOverlay(ctx, template, config, metadata);
  } else if (isFullBleed) {
    // Vertical full-bleed (tall screenshot): overlay scrim at bottom
    drawHorizontalOverlay(ctx, template, config, metadata);
  } else if (template.id === 'instagram-product' || template.id === 'instagram-story') {
    // Vertical short screenshot: info card below
    drawInstagramInfoCard(ctx, template, config, metadata, screenshotBottomY);
  } else {
    drawInfoOverlay(ctx, template, config, metadata, screenshotBottomY);
    if (config.showBrand) {
      drawBrand(ctx, template, config);
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create poster blob'));
    }, 'image/png', 0.95);
  });
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  template: PosterTemplate,
  config: PosterConfig
): void {
  const { width, height } = template;

  switch (config.backgroundStyle) {
    case 'gradient':
      // Warm gradient for e-commerce
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#fef3c7'); // amber-100
      gradient.addColorStop(0.5, '#fde68a'); // amber-200
      gradient.addColorStop(1, '#fcd34d'); // amber-300
      ctx.fillStyle = gradient;
      break;
    case 'dark':
      const darkGradient = ctx.createLinearGradient(0, 0, width, height);
      darkGradient.addColorStop(0, '#1e293b');
      darkGradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = darkGradient;
      break;
    case 'solid':
    default:
      ctx.fillStyle = '#ffffff';
  }

  ctx.fillRect(0, 0, width, height);

  // Add subtle pattern
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = config.accentColor;
  for (let x = 0; x < width; x += 40) {
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

async function drawScreenshot(
  ctx: CanvasRenderingContext2D,
  imageUrl: string,
  template: PosterTemplate,
  config: PosterConfig
): Promise<{ bottomY: number; isFullBleed: boolean }> {
  const { width, height } = template;

  // Load image
  const img = await loadImage(imageUrl);

  // Calculate frame dimensions based on template
  let frameWidth: number;
  let frameHeight: number;
  let frameX: number;
  let frameY: number;
  let isFullBleed = false;

  if (template.id === 'twitter-card' || template.id === 'facebook-ad') {
    // Horizontal: always full-bleed
    frameWidth = width;
    frameHeight = height;
    frameX = 0;
    frameY = 0;
    isFullBleed = true;
  } else if (template.id === 'instagram-story' || template.id === 'instagram-product') {
    // Adaptive: drive by canvas width (with small margin)
    const maxFrameW = width * 0.92;
    frameWidth = maxFrameW;
    frameHeight = frameWidth * (img.height / img.width);

    if (frameHeight >= height * 0.90) {
      // Screenshot is tall enough to fill canvas → full-bleed
      frameWidth = width;
      frameHeight = height;
      frameX = 0;
      frameY = 0;
      isFullBleed = true;
    } else {
      // Screenshot is short → center vertically in upper portion, leave room for info card
      const maxH = height * 0.62;
      if (frameHeight > maxH) {
        frameHeight = maxH;
        frameWidth = frameHeight * (img.width / img.height);
      }
      frameX = (width - frameWidth) / 2;
      // Center vertically in the upper 62% zone
      frameY = Math.max(height * 0.03, (height * 0.62 - frameHeight) / 2);
    }
  } else {
    // Fallback
    frameWidth = width * 0.85;
    frameHeight = frameWidth * (img.height / img.width);
    frameX = (width - frameWidth) / 2;
    frameY = height * 0.15;
  }

  const cornerRadius = isFullBleed ? 0 : 20;
  const padding = isFullBleed ? 0 : 8;

  if (!isFullBleed) {
    // Phone frame shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 15;
    ctx.beginPath();
    roundRect(ctx, frameX - padding, frameY - padding, frameWidth + padding * 2, frameHeight + padding * 2, cornerRadius + 4);
    ctx.fillStyle = '#1f2937';
    ctx.fill();
    ctx.restore();
  }

  // Screen area (clip + draw)
  ctx.save();
  ctx.beginPath();
  if (isFullBleed) {
    ctx.rect(0, 0, width, height);
  } else {
    roundRect(ctx, frameX, frameY, frameWidth, frameHeight, cornerRadius);
  }
  ctx.clip();

  if (isFullBleed) {
    // object-fit: cover — scale by width, top-align, clip overflow at bottom
    const scale = width / img.width;
    const drawW = img.width * scale;   // = width
    const drawH = img.height * scale;
    // Center vertically if image is shorter than canvas, otherwise top-align
    const drawY = drawH < height ? (height - drawH) / 2 : 0;
    ctx.drawImage(img, 0, drawY, drawW, drawH);
  } else {
    ctx.drawImage(img, frameX, frameY, frameWidth, frameHeight);
  }
  ctx.restore();

  // Notch for phone (instagram only)
  if (template.id.includes('instagram')) {
    const notchWidth = 80;
    const notchHeight = 25;
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    roundRect(ctx, frameX + (frameWidth - notchWidth) / 2, frameY - padding, notchWidth, notchHeight, 12);
    ctx.fill();
  }

  return { bottomY: frameY + frameHeight + padding, isFullBleed };
}

function drawHorizontalOverlay(
  ctx: CanvasRenderingContext2D,
  template: PosterTemplate,
  config: PosterConfig,
  metadata: ScreenshotMetadata
): void {
  const { width, height } = template;

  // How much vertical space the text needs
  const hasText = !!(config.title || config.subtitle || config.price);
  const scrimHeight = hasText ? Math.round(height * 0.52) : 80;

  // Gradient scrim: fully transparent at top, deep dark at bottom
  ctx.save();
  const scrim = ctx.createLinearGradient(0, height - scrimHeight, 0, height);
  scrim.addColorStop(0, 'rgba(0,0,0,0)');
  scrim.addColorStop(0.35, 'rgba(0,0,0,0.6)');
  scrim.addColorStop(1, 'rgba(0,0,0,0.93)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, height - scrimHeight, width, scrimHeight);
  ctx.restore();

  // Text content, bottom-aligned with padding
  ctx.save();
  ctx.textAlign = 'left';
  const padX = 60;
  let textY = height - 56; // start from bottom up

  // Brand (bottom-right corner)
  if (config.showBrand) {
    ctx.font = `18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(config.brandText, width - padX, height - 28);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // URL line
  if (config.showUrl) {
    ctx.font = `20px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const parts: string[] = [];
    try { parts.push(new URL(metadata.url).hostname); } catch { parts.push(metadata.url.substring(0, 40)); }
    if (config.showTimestamp) parts.push(new Date(metadata.timestamp).toLocaleDateString());
    ctx.fillText(parts.join(' · '), padX, textY);
    textY -= 36;
  }

  // Price badge (inline left-aligned)
  if (config.price) {
    ctx.font = `bold 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    const badgeW = ctx.measureText(config.price).width + 48;
    const badgeH = 48;
    const badgeY = textY - badgeH;
    ctx.fillStyle = config.accentColor;
    roundRect(ctx, padX, badgeY, badgeW, badgeH, 24);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.price, padX + 24, badgeY + badgeH / 2);
    ctx.textBaseline = 'alphabetic';
    textY = badgeY - 20;
  }

  // Subtitle
  if (config.subtitle) {
    ctx.font = `22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.fillText(config.subtitle, padX, textY);
    textY -= 40;
  }

  // Title
  if (config.title) {
    ctx.font = `bold 44px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(config.title, padX, textY);
  }

  ctx.restore();
}

function drawInstagramInfoCard(
  ctx: CanvasRenderingContext2D,
  template: PosterTemplate,
  config: PosterConfig,
  metadata: ScreenshotMetadata,
  screenshotBottomY: number
): void {
  const { width, height } = template;
  const cardX = 0;
  const cardY = screenshotBottomY;
  const cardW = width;
  const cardH = height - screenshotBottomY;

  // Card background with accent color
  ctx.save();
  const cardGrad = ctx.createLinearGradient(0, cardY, 0, height);
  const accent = config.accentColor;
  cardGrad.addColorStop(0, accent + 'cc');
  cardGrad.addColorStop(1, accent + 'ff');
  ctx.fillStyle = cardGrad;
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.restore();

  // Content inside card, vertically centered
  const padding = 60;
  let textY = cardY + padding;

  ctx.save();
  ctx.textAlign = 'center';

  // Title
  if (config.title) {
    ctx.font = `bold 52px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(config.title, width / 2, textY + 52);
    textY += 52 + 28;
  }

  // Subtitle
  if (config.subtitle) {
    ctx.font = `28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(config.subtitle, width / 2, textY + 28);
    textY += 28 + 32;
  }

  // Price badge
  if (config.price) {
    ctx.font = `bold 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    const badgeW = ctx.measureText(config.price).width + 72;
    const badgeH = 64;
    const badgeX = (width - badgeW) / 2;
    const badgeY = textY;

    ctx.fillStyle = '#ffffff';
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 32);
    ctx.fill();

    ctx.fillStyle = accent;
    ctx.textBaseline = 'middle';
    ctx.fillText(config.price, width / 2, badgeY + badgeH / 2);
    ctx.textBaseline = 'alphabetic';
    textY += badgeH + 36;
  }

  // URL
  if (config.showUrl) {
    ctx.font = `22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    try {
      ctx.fillText(new URL(metadata.url).hostname, width / 2, textY + 22);
    } catch {
      ctx.fillText(metadata.url.substring(0, 30), width / 2, textY + 22);
    }
    textY += 22 + 24;
  }

  // Brand
  if (config.showBrand) {
    ctx.font = `20px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'right';
    ctx.fillText(config.brandText, width - 48, height - 40);
  }

  ctx.restore();
}

function drawInfoOverlay(
  ctx: CanvasRenderingContext2D,
  template: PosterTemplate,
  config: PosterConfig,
  metadata: ScreenshotMetadata,
  screenshotBottomY: number
): void {
  const { width, height } = template;
  ctx.save();

  // Start text just below the screenshot frame with a small gap
  const gap = template.id === 'instagram-story' ? 60 : 36;
  let textY = screenshotBottomY + gap;

  const isShortHorizontal = template.id === 'twitter-card' || template.id === 'facebook-ad';

  // Title
  if (config.title) {
    const titleSize = template.id.includes('story') ? 56 : isShortHorizontal ? 32 : 42;
    ctx.font = `bold ${titleSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = config.backgroundStyle === 'dark' ? '#ffffff' : '#1f2937';
    ctx.textAlign = 'center';
    ctx.fillText(config.title, width / 2, textY);
    textY += template.id.includes('story') ? 70 : isShortHorizontal ? 40 : 55;
  }

  // Subtitle
  if (config.subtitle) {
    const subtitleSize = template.id.includes('story') ? 32 : isShortHorizontal ? 20 : 24;
    ctx.font = `${subtitleSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = config.backgroundStyle === 'dark' ? '#9ca3af' : '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText(config.subtitle, width / 2, textY);
    textY += template.id.includes('story') ? 50 : isShortHorizontal ? 30 : 40;
  }

  // Price with badge
  if (config.price) {
    const badgeWidth = ctx.measureText(config.price).width + 60;
    const badgeHeight = template.id.includes('story') ? 70 : isShortHorizontal ? 44 : 56;
    const badgeX = (width - badgeWidth) / 2;
    const badgeY = textY;

    // Badge background
    ctx.fillStyle = config.accentColor;
    roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
    ctx.fill();

    // Price text
    ctx.font = `bold ${template.id.includes('story') ? 40 : isShortHorizontal ? 24 : 32}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.price, width / 2, badgeY + badgeHeight / 2);

    textY += badgeHeight + 30;
  }

  // URL and metadata
  if (config.showUrl || config.showDeviceInfo || config.showTimestamp) {
    textY += 20;
    ctx.font = `${template.id.includes('story') ? 22 : 18}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = config.backgroundStyle === 'dark' ? '#9ca3af' : '#9ca3af';
    ctx.textAlign = 'center';

    const parts: string[] = [];
    if (config.showUrl) {
      try {
        const url = new URL(metadata.url);
        parts.push(url.hostname);
      } catch {
        parts.push(metadata.url.substring(0, 30));
      }
    }
    if (config.showDeviceInfo && metadata.viewport?.width && metadata.viewport?.height) {
      parts.push(`${metadata.viewport.width}×${metadata.viewport.height}`);
    }
    if (config.showTimestamp) {
      parts.push(new Date(metadata.timestamp).toLocaleDateString());
    }

    if (parts.length > 0) {
      ctx.fillText(parts.join(' · '), width / 2, textY);
    }
  }

  ctx.restore();
}

function drawBrand(
  ctx: CanvasRenderingContext2D,
  template: PosterTemplate,
  config: PosterConfig
): void {
  const { width, height } = template;
  const padding = template.id.includes('story') ? 50 : 40;

  ctx.save();
  ctx.font = `${template.id.includes('story') ? 24 : 20}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.fillStyle = config.backgroundStyle === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(config.brandText, width - padding, height - padding);
  ctx.restore();
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
