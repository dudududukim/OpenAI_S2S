import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';

const startBtn = document.getElementById('start') as HTMLButtonElement;
const stopBtn = document.getElementById('stop') as HTMLButtonElement;
const logEl = document.getElementById('log') as HTMLPreElement;

let session: RealtimeSession | null = null;

// 로그 타입 정의
type LogType = 'session' | 'transport' | 'default';

function log(...args: any[]): void;
function log(type: LogType, ...args: any[]): void;
function log(typeOrFirstArg: LogType | any, ...args: any[]) {
    let logType: LogType = 'default';
    let logArgs: any[];

    // 첫 번째 인자가 LogType인지 확인
    if (typeof typeOrFirstArg === 'string' && 
        ['session', 'transport', 'default'].includes(typeOrFirstArg)) {
        logType = typeOrFirstArg as LogType;
        logArgs = args;
    } else {
        logArgs = [typeOrFirstArg, ...args];
    }

    const line = logArgs.map(a => {
      if (typeof a === 'string') {
        return a;
      }
      return JSON.stringify(a, (key, value) => {
        // audio 필드가 문자열이고 길면 짧게 자르기
        if (key === 'audio' && typeof value === 'string' && value.length > 50) {
          return value.substring(0, 50) + '...[audio data truncated]';
        }
        return value;
      });
    }).join(' ');

    // 색깔별 스타일 적용
    const colors = {
        session: '#2196F3',    // 파란색 - session 이벤트
        transport: '#FF9800',  // 주황색 - transport 이벤트
        default: '#333333'     // 기본 색깔
    };

    const coloredLine = `<span style="color: ${colors[logType]};">${line}</span>\n`;
    logEl.innerHTML += coloredLine;
    logEl.scrollTop = logEl.scrollHeight;
}

// -------------- code(history log) --------------

type HistItem = {
  id: string;
  role: 'user' | 'assistant' | string;
  type: string;          // 'message' 등
  status?: string;       // 'in_progress'/'completed' 등
  text?: string;         // transcript or partial text
  truncatedAtMs?: number;
};

const historyStore: HistItem[] = [];

function renderHistory() {
  const wrap = document.getElementById('history-list');
  if (!wrap) return;

  const html = historyStore.map(it => {
    // const text = (it.text ?? '').slice(0, 120).replace(/\n/g, ' ');
    const text = (it.text ?? '');
    return `
      <div class="item">
        <div class="meta">
          <span class="role">${it.role}</span>
          <span>#${it.id.slice(-6)}</span>
          <span>· ${it.type}${it.status ? `/${it.status}` : ''}</span>
          ${it.truncatedAtMs != null ? `<span class="truncated">TRUNCATED @${it.truncatedAtMs}ms</span>` : ''}
        </div>
        ${text ? `<div>${text}</div>` : ''}
      </div>
    `;
  }).join('');

  wrap.innerHTML = html || '<div class="meta">— no items —</div>';
}


// -------------- code(event log) --------------

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

    // Transport 이벤트 (주황색으로 표시)
    // session.transport.on('*', (evt) => log('transport', 'transport', evt?.type || 'event', evt));

    // Transport 이벤트에서 delta 이벤트들을 필터링
    session.transport.on('*', (evt) => {
        const eventType = evt?.type || 'event';
        
        // delta 이벤트들은 제외
        if (eventType.includes('.delta')) {
            return; // 로그하지 않음
        }
        
        log('transport', 'transport', eventType, evt);
    });


    // --- Session 이벤트들 (파란색으로 표시) ---
    
    // Agents lifecycle
    session.on('agent_start', (ctx: any, agent: any) => {
        log('session', 'agent_start', { agent: agent?.name });
    });

    session.on('agent_end', (ctx: any, agent: any, output: string) => {
        log('session', 'agent_end', { agent: agent?.name, preview: String(output ?? '').slice(0, 160) });
    });

    session.on('agent_handoff', (ctx: any, from: any, to: any) => {
        log('session', 'agent_handoff', { from: from?.name, to: to?.name });
    });

    session.on('agent_tool_start', (ctx: any, agent: any, tool: any, args: any) => {
        log('session', 'agent_tool_start', { agent: agent?.name, tool: tool?.name, args });
    });

    session.on('agent_tool_end', (ctx: any, agent: any, tool: any, output: any, raw: any) => {
        log('session', 'agent_tool_end', { agent: agent?.name, tool: tool?.name, outputPreview: String(output ?? '').slice(0, 160) });
    });

    // Audio
    session.on('audio_start', (ctx: any, agent: any) => {
        log('session', 'audio_start', { agent: agent?.name });
    });

    session.on('audio', (e: any) => {
        const bytes = e?.data?.byteLength ?? 0;
        log('session', 'audio', { bytes, note: bytes ? 'audio buffer received' : undefined });
    });

    session.on('audio_stopped', (ctx: any, agent: any) => {
        log('session', 'audio_stopped', { agent: agent?.name });
    });

    session.on('audio_interrupted', (ctx: any, agent: any) => {
        log('session', 'audio_interrupted', { agent: agent?.name });
    });

    // History
    session.on('history_added', (item: any) => {
        log('session', 'history_added', summarizeItem(item));
    });

    session.on('history_updated', (history: any[]) => {
        // console.log('Available attributes:', Object.keys(history[0].content));
        // console.log('Available attributes:',history[0].content);
        // log('session', 'history_updated', { length: Array.isArray(history) ? history.length : 0 });
        log('session', 'history_updated', history);
        // renderHistory();
        updateHistoryFromEvent(history);
    });
    

    // Guardrails / Tools / Errors
    session.on('tool_approval_requested', (ctx: any, agent: any, req: any) => {
        log('session', 'tool_approval_requested', {
            tool: req?.rawItem?.name,
            approvalItem: req?.approvalItem?.id || req?.approvalItem?.name
        });
    });

    session.on('guardrail_tripped', (ctx: any, agent: any, tripwire: any, extra: any) => {
        log('session', 'guardrail_tripped', {
            agent: agent?.name,
            tripwire: tripwire?.tripwire?.name || tripwire?.tripwire_id || 'unknown'
        });
    });

    session.on('error', (err: any) => {
        log('session', 'session_error', normalizeError(err));
    });

    // Raw transport echo (SDK re-emits)
    session.on('transport_event', (evt: any) => {
        const side = evt?.mode || evt?.direction || evt?.source || 'unknown';
        const type = evt?.type || evt?.event?.type || 'event';
        if (type.includes('.delta')) return;
        log('session', 'transport_event', `[${side}]`, type);
    });


    const apiKey = await getClientKey();
    await session.connect({ apiKey });
    log('connected');
};

stopBtn.onclick = () => {
    if (!session) return;
    session.close();
    session = null;
    log('session', 'disconnected');
};

// --- 헬퍼 함수들 ---
function summarizeItem(item: any) {
    if (!item) return { note: 'empty item' };

    const id = item.id || item.item_id;
    const type = item.type || item.role || 'item';
    const text = Array.isArray(item?.content)
        ? item.content.map((c: any) => c?.text).filter(Boolean).join(' ').slice(0, 200)
        : (item?.text || '').slice(0, 200);

    return { id, type, ...(text ? { text } : {}) };
}

function normalizeError(err: any) {
    if (!err) return 'unknown error';
    if (typeof err === 'string') return err;
    if (err?.message) return { message: err.message, code: err.code ?? err.name };
    try { return JSON.stringify(err).slice(0, 300); } catch { return String(err); }
}

const saveBtn = document.getElementById('save') as HTMLButtonElement;

saveBtn.onclick = () => {
  const text = logEl.innerText;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `log-${stamp}.txt`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
};

function updateHistoryFromEvent(historyData: any[]) {
    historyData.forEach(item => {
        const existingIndex = historyStore.findIndex(h => h.id === item.itemId);
        
        if (existingIndex !== -1) {
            // 기존 항목 업데이트
            const existingItem = historyStore[existingIndex];
            
            // transcript 정보가 있으면 업데이트
            if (item.content && item.content[0] && item.content[0].transcript) {
                existingItem.text = item.content[0].transcript;
            }
            
            // status 업데이트
            if (item.status) {
                existingItem.status = item.status;
            }
        } else {
            // 새 항목 추가
            const newItem: HistItem = {
                id: item.itemId,
                role: item.role || 'user',
                type: item.type || 'message',
                status: item.status,
                text: item.content?.[0]?.transcript || ''
            };
            historyStore.push(newItem);
        }
    });
    
    // UI 업데이트
    renderHistory();
}
