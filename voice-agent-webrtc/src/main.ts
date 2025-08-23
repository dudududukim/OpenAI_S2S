import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';
import { scrollHistoryToBottom } from './utils/scroll';

const startBtn = document.getElementById('start') as HTMLButtonElement;
const stopBtn = document.getElementById('stop') as HTMLButtonElement;
const logEl = document.getElementById('log') as HTMLPreElement;

let session: RealtimeSession | null = null;

// 로그 타입 정의
type LogType = 'session' | 'transport' | 'handoff' | 'default';

function getCurrentTimeString(): string {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const s = now.getSeconds().toString().padStart(2, '0');
  const ms = now.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function log(...args: any[]): void;
function log(type: LogType, ...args: any[]): void;
function log(typeOrFirstArg: LogType | any, ...args: any[]) {
  let logType: LogType = 'default';
  let logArgs: any[];

  if (typeof typeOrFirstArg === 'string' && 
      ['session', 'transport', 'handoff', 'default'].includes(typeOrFirstArg)) {
    logType = typeOrFirstArg as LogType;
    logArgs = args;
  } else {
    logArgs = [typeOrFirstArg, ...args];
  }

  const timeStr = getCurrentTimeString();
  const line = logArgs.map(a => {
    if (typeof a === 'string') {
      return a;
    }
    return JSON.stringify(a, (key, value) => {
      if (key === 'audio' && typeof value === 'string' && value.length > 50) {
        return value.substring(0, 50) + '...[audio data truncated]';
      }
      return value;
    });
  }).join(' ');

  const colors = {
    session: '#2196F3',
    transport: '#FF9800', 
    handoff: '#9C27B0',
    default: '#374151',
    timestamp: '#9CA3AF'
  };

  // 시간은 default 색깔, 로그 내용은 타입별 색깔로 분리
  const coloredLine = `<span style="color: ${colors['timestamp']};">${timeStr}</span> <span style="color: ${colors[logType]};">${line}</span>\n`;
  
  logEl.innerHTML += coloredLine;
  logEl.scrollTop = logEl.scrollHeight;
}



// -------------- code(history log) --------------

type HistItem = {
  id: string;
  role: 'user' | 'assistant' | string;
  type: string;           // 'message'
  status?: string;        // 'in_progress'/'completed'
  text?: string;          // transcript or partial text
  name?: string;          // functional call name
  truncatedAtMs?: number;
};

const historyStore: HistItem[] = [];

function renderHistory() {
  const wrap = document.getElementById('history-list');
  if (!wrap) return;

  const html = historyStore.map(it => {
    const text = it.text ?? '';
    const fnName = it.type === 'function_call' && (it as any).name
      ? `· ${(it as any).name}`
      : '';

    return `
      <div class="item">
        <div class="meta">
          <span class="role">${it.role}</span>
          <span>#${it.id.slice(-6)}</span>
          <span>· ${it.type}${it.status ? `/${it.status}` : ''}</span>
          ${it.truncatedAtMs != null ? `<span class="truncated">TRUNCATED @${it.truncatedAtMs}ms</span>` : ''}
        </div>
        ${fnName ? `<div>${fnName}</div>` : ''}
        ${text ? `<div>${text}</div>` : ''}
      </div>
    `;
  }).join('');

  wrap.innerHTML = html || '<div class="meta">— no items —</div>';
  scrollHistoryToBottom();
}

// -------------- code(event log) --------------

async function getClientKey(): Promise<string> {
    const r = await fetch('http://localhost:8787/session', { method: 'POST' });
    const { apiKey } = await r.json();
    if (!apiKey) throw new Error('No ephemeral key');
    return apiKey;
}

const cumpa_agent = new RealtimeAgent({
  name : "cumpa",
  instructions : `
    bot_name: Cumpa
    bot_desc: An empathetic chatbot for mental health care which helps users to be aware of and accept their emotion and desire.
    start_phase: Greeting
    finish_phases:
      - Goodbye
    phases:
      - name: Greeting
        goal: Greet user with kindness and choose which micro intervention(IV) to proceed.
        action_list:
          - start
          - finish
          - ask_question
          - give_example
          - fallback
        instruction: |
          Refer to the basic steps below, but you can adjust them according to the user's utterance.
          1. Greet user.
          2. Ask user if the user wants to talk about positive/negative emotion or conduct mindfulness meditation.
          3. If user wants to talk about positive/negative emotion, select one of IV1-IV5 corresponding to the user emotion. If user wants to conduct mindfulness meditation, select IV6.
        router_list:
          - criteria: If user has POSITIVE emotion, and you want user to pay attention to user's emotion.
            next_phase: IV1-pos
          - criteria: If user has NEGATIVE emotion, and you want user to pay attention to user's emotion.
            next_phase: IV1-neg
          - criteria: If user has POSITIVE emotion, and you want user to pay attention to user's situation of the emotion.
            next_phase: IV2-pos
          - criteria: If user has NEGATIVE emotion, and you want user to pay attention to user's situation of the emotion.
            next_phase: IV2-neg
          - criteria: If user has POSITIVE emotion, and you want user to notice user's thought, and body's reaction of the emotion.
            next_phase: IV3-pos
          - criteria: If user has NEGATIVE emotion, and you want user to notice user's thought, and body's reaction of the emotion.
            next_phase: IV3-neg
          - criteria: If user has POSITIVE emotion, and you want user to pay attention to desire that user hope, and expected behind the emotion.
            next_phase: IV4-pos
          - criteria: If user has NEGATIVE emotion, and you want user to pay attention to desire that user hope, and expected behind the emotion.
            next_phase: IV4-neg
          - criteria: If user has POSITIVE emotion, and you want user to notice fulfilled desires among 3 fundamental desires behind the emotion.
            next_phase: IV5-pos
          - criteria: If user has NEGATIVE emotion, and you want user to notice unfulfilled desires among 3 fundamental desires behind the emotion.
            next_phase: IV5-neg
          - criteria: If user wants to conduct a mindfulness meditation.
            next_phase: IV6
      - name: IV1-pos
        goal: Guide user to express user's POSITIVE emotion and ask if user is satisfied with the conversation.
        action_list:
          - start
          - finish
          - ask_question
          - give_example
          - fallback
          - express_experience
          - score_experience
          - accept_experience_with_kindness
        instruction: |
          Refer to the basic steps below, but you can adjust them according to the user's utterance.
          1. Explain what will be done in the current phase.
          2. Help user to express emotion.
          3. Make user to score the impact of the emotion from 0 to 100.
          4. Help user to accept the emotion with kindness.
          5. Ask if user is satisfied with the conversation.
        router_list:
          - criteria: If user satisfied with the conversation.
            next_phase: Goodbye
          - criteria: If user is not satisfied or wants to talk more.
            next_phase: Greeting
      - name: IV1-neg
        goal: Guide user to express user's NEGATIVE emotion and ask if user is satisfied with the conversation.
        action_list:
          - start
          - finish
          - ask_question
          - give_example
          - fallback
          - express_experience
          - score_experience
          - accept_experience_with_kindness
        instruction: |
          Refer to the basic steps below, but you can adjust them according to the user's utterance.
          1. Explain what will be done in the current phase.
          2. Help user to express emotion.
          3. Make user to score the impact of the emotion from 0 to 100.
          4. Help user to accept the emotion with kindness.
          5. Ask if user is satisfied with the conversation.
        router_list:
          - criteria: If user satisfied with the conversation.
            next_phase: Goodbye
          - criteria: If user is not satisfied or wants to talk more.
            next_phase: Greeting
  `
})


const Korean_20_agent = new RealtimeAgent({
    name: 'Korean_20_agent',
    instructions: `You are a specialized Korean speaking assistant for people in their 20s.
    
    COMMUNICATION STYLE:
    - Use casual, friendly Korean (반말/존댓말 적절히 혼용)
    - Use 20s generation slang and expressions naturally
    - Reference popular culture, trends, and topics relevant to Korean 20-somethings
    - Understand concerns about career, relationships, studies, and social life
    
    PERSONALITY:
    - Be like a friendly peer, not overly formal
    - Show empathy for 20s-specific struggles (job hunting, dating, adulting)
    - Use expressions like "아 진짜?", "대박", "ㅋㅋ", "그쵸" naturally
    - Be encouraging and supportive with a youthful energy
    
    TOPICS TO EXCEL AT:
    - Career advice and job searching tips
    - University life and study tips  
    - Dating and relationship advice
    - Popular Korean entertainment (K-pop, dramas, movies)
    - Technology and social media trends
    - Food recommendations and lifestyle tips

    HANDOFF RULES:
    - If user expresses emotional concerns, stress, sadness, or asks for mindfulness/mental health help, handoff to cumpa_agent

    STYLE ADDITION:
    - Keep responses short, snappy, and to the point (짧고 간결하게).`,
    handoffs : [cumpa_agent],
})

const agent = new RealtimeAgent({
    name: 'Assistant',
    instructions: `You are a helpful voice assistant. 

    FIRST PRIORITY: If you don't know the user's age, ask for their age in a friendly way.

    HANDOFF RULES:
    - If user speaks Korean AND is in their 20s (20-29 years old), handoff to Korean_20_agent
    - If user speaks Korean but is NOT in their 20s, provide general Korean assistance yourself
    - If user speaks other languages, provide general assistance
    - If user expresses emotional concerns, stress, sadness, or asks for mindfulness/mental health help, handoff to cumpa_agent

    Always be polite and helpful in determining user's age, language, and emotional needs.`,    
    handoffs: [Korean_20_agent, cumpa_agent]
});


startBtn.onclick = async () => {
    if (session) return;

    try {
    //     const agent = new RealtimeAgent({
    //       name: 'Assistant',
    //       instructions: 'You are a helpful voice assistant.'
    //   });

      session = new RealtimeSession(agent, {
          model: 'gpt-4o-realtime-preview-2025-06-03',
          config: {
            inputAudioTranscription: {
              model: 'gpt-4o-mini-transcribe',
              language: 'ko',
            },
          }
      });

      // Transport 이벤트에서 delta 이벤트들을 필터링
      session.transport.on('*', (evt) => {
          const eventType = evt?.type || 'event';
          
          // delta 이벤트들은 제외
          if (eventType.includes('.delta')) {
              return; // 로그하지 않음
          }

          if (eventType === 'error') {
            showPopup(evt.error?.message ?? JSON.stringify(evt));   // OpenAI Agents SDK bug!
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
          showPopup(err.message);
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
      
      session.sendMessage("안녕하세요! 대화를 시작하겠습니다.");
      log('connected');
    } catch (error) {
      log("session", "💥 연결 실패:", error);
      session = null;
    }
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

function getFnName(item: any): string | undefined {
  if (item.type !== 'function_call') return undefined;
  return (
    item.name ||
    item.function?.name ||
    item.tool_call?.function?.name ||
    item.content?.find?.((c: any) => c?.name)?.name
  );
}

function updateHistoryFromEvent(history: any[]) {
    history.forEach(item => {
        const existingIndex = historyStore.findIndex(h => h.id === item.itemId);
        
        if (existingIndex !== -1) {
            const existingItem = historyStore[existingIndex];
            
            if (item.content && item.content[0]) {
                const content = item.content[0];
                const text = content.transcript || content.text || '';
                if (text) {
                    existingItem.text = text;
                }
            }
            
            if (item.status) {
                existingItem.status = item.status;
            }
        } else {
            const content = item.content?.[0];
            const text = content?.transcript || content?.text || '';
            
            const newItem: HistItem = {
                id: item.itemId,
                role: item.role || 'user',
                type: item.type || 'message',
                status: item.status,
                name: getFnName(item),
                text: text,
            };
            historyStore.push(newItem);
        }
    });
    
    renderHistory();
}


function showPopup(message: string) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  }, 4000);
}

// hamburger menu

const menuBtn = document.querySelector('.menu-button') as HTMLButtonElement;
const historyPanel = document.querySelector('.history-panel') as HTMLElement;

menuBtn?.addEventListener('click', () => {
  historyPanel?.classList.toggle('open');
});

const historyCloseBtn = document.querySelector('.history-header button') as HTMLButtonElement;
historyCloseBtn?.addEventListener('click', () => {
  historyPanel?.classList.remove('open');
});

const aecBtn = document.getElementById('aec-calibration') as HTMLButtonElement;
const aecProgress = aecBtn.querySelector('.aec-progress') as HTMLElement;
let aecAudio: HTMLAudioElement | null = null;

aecBtn.addEventListener('click', async () => {
    if (aecAudio && !aecAudio.paused) return;
    
    try {
        aecAudio = new Audio('assets/audio/ElevenLabs_2025-08-17T15_15_42_Salang_pvc_sp100_s50_sb33_se0_b_m2.mp3');
        aecBtn.disabled = true;
        aecProgress.style.width = '0%';

        // --- GainNode 추가 ---
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const track = audioCtx.createMediaElementSource(aecAudio);
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 1.2; // +20%
        track.connect(gainNode).connect(audioCtx.destination);

        aecAudio.addEventListener('timeupdate', () => {
            const progress = (aecAudio!.currentTime / aecAudio!.duration) * 100;
            aecProgress.style.width = `${progress}%`;
        });
        
        aecAudio.addEventListener('ended', () => {
            aecProgress.style.width = '0%';
            aecBtn.disabled = false;
            log('AEC 캘리브레이션 완료');
        });
        
        aecAudio.addEventListener('error', () => {
            aecProgress.style.width = '0%';
            aecBtn.disabled = false;
            log('AEC 캘리브레이션 오류');
        });
        
        await audioCtx.resume(); // context 활성화 (필수)
        await aecAudio.play();
        log('AEC 캘리브레이션 시작');
    } catch (error) {
        aecProgress.style.width = '0%';
        aecBtn.disabled = false;
        log('오디오 재생 실패:', error);
    }
});
