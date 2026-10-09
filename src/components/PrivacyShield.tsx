import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, WifiOff } from 'lucide-react';

/** Counts resources the page has fetched from any origin other than its own. */
function externalRequests(): string[] {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return [];
  return performance
    .getEntriesByType('resource')
    .map((e) => e.name)
    .filter((url) => {
      try {
        const u = new URL(url, location.href);
        return /^https?:$/.test(u.protocol) && u.origin !== location.origin;
      } catch {
        return false;
      }
    });
}

export function PrivacyShield({ onClick }: { onClick: () => void }) {
  const [external, setExternal] = useState<string[]>(externalRequests);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const tick = () => setExternal(externalRequests());
    const id = window.setInterval(tick, 2000);
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);

  const clean = external.length === 0;
  return (
    <button className={`shield ${clean ? 'is-clean' : 'is-warn'}`} onClick={onClick} title="What has this page sent over the network?">
      {clean ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
      <span className="shield-label">On-device</span>
      <span className="shield-count">
        {external.length} external request{external.length === 1 ? '' : 's'}
      </span>
      {!online && (
        <span className="shield-offline">
          <WifiOff size={13} /> offline
        </span>
      )}
    </button>
  );
}

export { externalRequests };
