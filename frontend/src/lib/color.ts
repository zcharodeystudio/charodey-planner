export function hsvToHex(hue: number, saturation: number, value: number) {
  const h = ((hue % 360) + 360) % 360;
  const s = Math.min(1, Math.max(0, saturation));
  const v = Math.min(1, Math.max(0, value));
  const chroma = v * s;
  const section = h / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const match = v - chroma;
  const channels =
    section < 1 ? [chroma, x, 0] : section < 2 ? [x, chroma, 0] : section < 3 ? [0, chroma, x] : section < 4 ? [0, x, chroma] : section < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const hex = (channel: number) => Math.round((channel + match) * 255).toString(16).padStart(2, '0');
  return `#${hex(channels[0])}${hex(channels[1])}${hex(channels[2])}`.toUpperCase();
}

export function hexToHsv(hex: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const raw = match[1];
  const red = parseInt(raw.slice(0, 2), 16) / 255;
  const green = parseInt(raw.slice(2, 4), 16) / 255;
  const blue = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const hue = delta === 0 ? 0 : max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return { h: (hue * 60 + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}

function luminance(hex: string) {
  const raw = hex.replace('#', '');
  const tone = (part: string) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * tone(raw.slice(0, 2)) + 0.7152 * tone(raw.slice(2, 4)) + 0.0722 * tone(raw.slice(4, 6));
}

export function accentFromHex(hex: string) {
  const hsv = hexToHsv(hex) ?? { h: 45, s: 0.75, v: 0.91 };
  const primary = hsvToHex(hsv.h, hsv.s, hsv.v);
  return {
    primary,
    primaryPressed: hsvToHex(hsv.h, Math.min(1, hsv.s + 0.06), Math.max(0.28, hsv.v * 0.82)),
    primaryMuted: hsvToHex(hsv.h, Math.min(0.42, hsv.s * 0.32 + 0.14), 0.97),
    onPrimary: luminance(primary) > 0.62 ? '#3A2614' : '#FFFFFF',
  };
}
