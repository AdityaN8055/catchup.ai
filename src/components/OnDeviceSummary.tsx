import { useEffect, useState } from 'react';
import { Cpu, Loader2 } from 'lucide-react';
import type { Conversation } from '../parsers';

/*
 * Optional enhancement: Chrome's built-in Summarizer API runs Gemini Nano
 * entirely on the device. It is only offered when the browser exposes it;
 * otherwise CatchUp's own pattern-based summary is used on its own.
 */
interface SummarizerLike {
  summarize(text: string, opts?: { context?: string }): Promise<string>;
  destroy?: () => void;
  inputQuota?: number;
}
interface SummarizerStatic {
  availability(): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(opts: Record<string, unknown>): Promise<SummarizerLike>;
}

function getSummarizer(): SummarizerStatic | null {
  const s = (globalThis as unknown as { Summarizer?: SummarizerStatic }).Summarizer;
  return s && typeof s.create === 'function' ? s : null;
}

export function OnDeviceSummary({ conversation, since }: { conversation: Conversation; since: Date | null }) {
  const [state, setState] = useState<'checking' | 'unsupported' | 'ready' | 'running' | 'done' | 'error'>('checking');
  const [summary, setSummary] = useState('');
  const [needsDownload, setNeedsDownload] = useState(false);

  useEffect(() => {
    const api = getSummarizer();
    if (!api) {
      setState('unsupported');
      return;
    }
    api
      .availability()
      .then((a) => {
        if (a === 'unavailable') setState('unsupported');
        else {
          setNeedsDownload(a !== 'available');
          setState('ready');
        }
      })
      .catch(() => setState('unsupported'));
  }, []);

  if (state === 'unsupported' || state === 'checking') return null;

  const run = async () => {
    const api = getSummarizer();
    if (!api) return;
    setState('running');
    try {
      const summarizer = await api.create({ type: 'key-points', format: 'plain-text', length: 'medium' });
      const transcript = conversation.messages
        .filter((m) => !since || !m.timestamp || m.timestamp >= since)
        .map((m) => `${m.sender}: ${m.text}`)
        .join('\n');
      const quota = summarizer.inputQuota && Number.isFinite(summarizer.inputQuota) ? summarizer.inputQuota * 3 : 12000;
      const result = await summarizer.summarize(transcript.slice(-quota), {
        context: `A ${conversation.platform} chat called "${conversation.name}". Focus on requests, deadlines and decisions.`
      });
      summarizer.destroy?.();
      setSummary(result);
      setState('done');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="ondevice">
      {state === 'done' ? (
        <>
          <p className="ondevice-label">
            <Cpu size={13} /> On-device AI summary (Chrome built-in model)
          </p>
          <p className="ondevice-text">{summary}</p>
        </>
      ) : (
        <button className="btn ghost small" onClick={run} disabled={state === 'running'}>
          {state === 'running' ? <Loader2 size={14} className="spin" /> : <Cpu size={14} />}
          {state === 'error' ? 'On-device AI failed — retry' : 'Rewrite with on-device AI'}
          {needsDownload && state === 'ready' && <span className="muted"> · browser downloads model once</span>}
        </button>
      )}
    </div>
  );
}
