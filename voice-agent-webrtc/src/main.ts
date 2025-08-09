import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';

const startBtn = document.getElementById('start') as HTMLButtonElement;
const stopBtn = document.getElementById('stop') as HTMLButtonElement;
const logEl = document.getElementById('log') as HTMLPreElement;

let session: RealtimeSession | null = null;

function log(...args: any[]) {
  const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log(...args);
  logEl.textContent += line + '\n';
}

async function getClientKey(): Promise<string> {
  const r = await fetch('http://localhost:8787/session', { method: 'POST' });
  const { apiKey } = await r.json();
  if (!apiKey) throw new Error('No ephemeral key');
  return apiKey;
}

startBtn.onclick = async () => {
  if (session) return;

  const agent = new RealtimeAgent({
    name: 'Assistant',
    instructions: 'You are a helpful voice assistant.'
  });

  session = new RealtimeSession(agent, {
    model: 'gpt-4o-realtime-preview-2025-06-03'
  });

  session.on('history_updated', (h) => log('history_updated', h.length));
  session.on('error', (e) => log('session_error', e));

  session.transport.on('*', (evt) => log('transport', evt?.type || 'event', evt));

  const apiKey = await getClientKey();
  await session.connect({ apiKey });

  log('connected');
};

stopBtn.onclick = () => {
  if (!session) return;
  session.close();
  session = null;
  log('disconnected');
};
