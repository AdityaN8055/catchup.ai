import type { Platform } from '../parsers';

const LABEL: Record<Platform, string> = { whatsapp: 'WhatsApp', telegram: 'Telegram', generic: 'Text' };

export function PlatformMark({ platform }: { platform: Platform }) {
  return (
    <span className={`pmark pmark-${platform}`} title={LABEL[platform]} aria-label={LABEL[platform]}>
      {platform === 'whatsapp' ? 'W' : platform === 'telegram' ? 'T' : '¶'}
    </span>
  );
}

export function platformLabel(p: Platform) {
  return LABEL[p];
}
