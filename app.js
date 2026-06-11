/* ============================================================
   GymTrack — tracking de ginásio com progressão automática
   v2: equipamento por exercício (halteres/barra/máquina/corpo/tempo),
   carga por série, plano real do João + histórico semanas 21-24.
   Dados locais (localStorage) + export/import JSON.
   ============================================================ */
'use strict';

const STORE_KEY = 'gymtrack-v2';
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const FEEDBACKS = [
  { id: 'easy', label: '😎 Fácil' },
  { id: 'ok',   label: '👍 Bom'   },
  { id: 'hard', label: '🥵 Difícil' },
  { id: 'fail', label: '❌ Falhei' },
];
const EQUIPS = {
  halteres: { label: 'Halteres', unit: 'kg',    step: 0.5 },
  barra:    { label: 'Barra',    unit: 'kg',    step: 0.5 },
  maquina:  { label: 'Máquina',  unit: 'nível', step: 1   },
  corpo:    { label: 'Peso corporal', unit: '', step: 0   },
  tempo:    { label: 'Tempo',    unit: 's',     step: 0   },
};
const hasWeight = equip => equip !== 'corpo' && equip !== 'tempo';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDateShort = iso => new Date(iso + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const roundStep = (n, step) => step ? Math.round(n / step) * step : n;

function weightsLabel(e) {
  if (e.equip === 'tempo') return `${e.targetReps || e.repsMin}s`;
  if (e.equip === 'corpo') return 'peso corporal';
  const w = (e.weights || []).join('/');
  return e.equip === 'maquina' ? `nív. ${w}` : `${w} kg`;
}
function repsLabel(e) {
  const r = e.repsMin === e.repsMax ? e.repsMin : `${e.repsMin}–${e.repsMax}`;
  return e.equip === 'tempo' ? `${e.sets}×${e.targetReps || e.repsMin}s` : `${e.sets}×${r}`;
}

/* ---------------- plano real + histórico (semanas 21-24) ---------------- */
function ex(name, equip, sets, repsMin, repsMax, weights, increment, lastAdj = '') {
  return { id: uid(), name, equip, sets, repsMin, repsMax,
    weights: weights ? weights.slice() : [], increment,
    targetReps: equip === 'tempo' ? 45 : repsMin, failStreak: 0, lastAdj };
}
function hx(name, equip, weights, reps, feedback, note = '') {
  return { exId: null, name, equip, feedback, note,
    sets: reps.map((r, i) => ({ weight: weights ? weights[i] : 0, reps: r, done: true })) };
}
function hist(date, name, exercises, notes = '') {
  return { id: uid(), planDayId: null, name, date,
    startedAt: date + 'T18:00:00.000Z', finishedAt: date + 'T19:00:00.000Z', notes, exercises };
}
function defaultState() {
  return {
    version: 3,
    settings: { unit: 'kg', restSeconds: 90 },
    coachNotes: [
      { date: '2026-06-11', text: 'Semana 25 — última do Mesociclo 1. Mantém as cargas que a app sugere e não forces o isquio direito (RDL, lunges, bulgarians: pára se houver desconforto). No fim desta semana fazemos a revisão completa e na S26 arranca o Mesociclo 2 com ~30% dos exercícios trocados.' },
    ],
    plan: {
      days: [
        { id: 'dA', name: 'Dia A — Quad + Push/Pull horizontal', weekdays: [1], exercises: [
          ex('Leg Press', 'maquina', 4, 10, 12, [11, 12, 13, 14], 1, 'Subir: fez 4×12 tranquilo a nív. 10-13'),
          ex('DB Bench Press', 'halteres', 3, 10, 12, [12, 14, 16], 2, 'Repetir 12/14/16 — última cortou às 9 reps'),
          ex('DB Row 1-braço', 'halteres', 3, 10, 12, [12, 14, 16], 2, 'Manter; vigiar técnica (baixar p/ 14 se partir)'),
          ex('DB RDL', 'halteres', 3, 12, 12, [10, 12, 15], 2, 'Isquio ok na S24 — se continuar bem, subir'),
          ex('DB Lateral Raise', 'halteres', 3, 12, 12, [7, 7, 7], 1, 'Subir: 6/7/7 → 7/7/7'),
          ex('Cable Curl (barra reta)', 'maquina', 3, 12, 12, [6, 6, 7], 1, 'Pode subir (3×12 limpas na S24)'),
          ex('Plank frontal', 'tempo', 3, 30, 90, null, 15),
        ]},
        { id: 'dB', name: 'Dia B — Posterior + Push/Pull vertical', weekdays: [3], exercises: [
          ex('DB RDL', 'halteres', 4, 12, 12, [10, 12, 14, 16], 2, 'S21 foi fácil — atenção ao isquio direito'),
          ex('Lat Pulldown', 'maquina', 4, 8, 12, [10, 12, 13, 14], 1, 'Manter nív. 14 até saírem 10-12 reps'),
          ex('DB Shoulder Press', 'halteres', 4, 10, 12, [8, 10, 10, 12], 2, 'Subir (S21 foi fácil)'),
          ex('Walking Lunges DB', 'halteres', 3, 10, 10, [6, 8, 8], 2, 'Cuidado com o isquio direito'),
          ex('Face Pull', 'maquina', 3, 12, 15, [5, 6, 6], 1),
          ex('Triceps Pushdown (corda)', 'maquina', 4, 10, 15, [3, 4, 4, 5], 1),
          ex('DB Chest Fly (aberturas)', 'halteres', 3, 10, 12, [8, 8, 8], 2, 'Novo — calibrar carga no 1.º treino'),
        ]},
        { id: 'dR', name: 'Corrida', type: 'cardio', weekdays: [], targetKm: 3, exercises: [] },
        { id: 'dC', name: 'Dia C — Misto', weekdays: [5], exercises: [
          ex('DB Bulgarian Split Squat', 'halteres', 3, 8, 8, [8, 8, 8], 2, 'Manter enquanto o isquio recupera'),
          ex('Incline DB Press', 'halteres', 4, 10, 12, [8, 10, 12, 12], 2, 'Consolidar 12 kg (última cortou às 6)'),
          ex('Seated Cable Row', 'maquina', 4, 12, 12, [11, 12, 12, 13], 1, 'Espaço para subir'),
          ex('Hip Thrust DB', 'halteres', 3, 12, 12, [10, 16, 16], 2),
          ex('DB Lateral Raise', 'halteres', 3, 12, 12, [7, 7, 7], 1),
          ex('Straight Bar Cable Curl', 'maquina', 4, 12, 12, [5, 6, 6, 6], 1, 'Subir quando saírem 4×12 limpas'),
          ex('Plank frontal', 'tempo', 3, 30, 90, null, 15),
        ]},
      ],
    },
    history: [
      hist('2026-05-20', 'Dia A — Quad + Push/Pull horizontal', [
        hx('Leg Press', 'maquina', [5, 6, 7, 8], [10, 10, 10, 10], 'easy'),
        hx('DB Bench Press', 'halteres', [10, 12, 14], [10, 10, 10], 'hard', 'Última custou'),
        hx('DB Row 1-braço', 'halteres', [10, 12, 14], [12, 10, 10], 'ok'),
        hx('DB RDL', 'halteres', [8, 10, 12, 12], [12, 12, 12, 10], 'ok', 'Bem'),
        hx('DB Lateral Raise', 'halteres', [6, 6, 7], [12, 12, 10], 'hard', 'Técnica partiu na última'),
        hx('Cable Curl (corda)', 'maquina', [4, 5, 6], [12, 12, 10], 'ok'),
        hx('Plank frontal', 'tempo', null, [45, 45, 45], 'ok'),
      ], 'Semana 21'),
      { ...hist('2026-05-21', 'Corrida', [], 'Semana 21 · blocos 6→10 km/h'), type: 'cardio', minutes: 25, km: 3 },
      hist('2026-05-23', 'Dia B — Posterior + Push/Pull vertical', [
        hx('DB RDL', 'halteres', [8, 10, 12, 14], [12, 12, 12, 12], 'easy'),
        hx('Lat Pulldown', 'maquina', [10, 12, 13, 14], [12, 12, 10, 8], 'hard', 'Última difícil'),
        hx('DB Shoulder Press', 'halteres', [6, 8, 10, 10], [12, 12, 12, 10], 'easy'),
        hx('Walking Lunges DB', 'halteres', [6, 8, 8], [10, 10, 10], 'hard', 'Cansativo (10/perna)'),
        hx('Face Pull', 'maquina', [4, 6, 6], [15, 12, 12], 'ok'),
        hx('Triceps Pushdown (corda)', 'maquina', [3, 3, 4, 4], [15, 15, 12, 10], 'ok'),
        hx('Hanging Knee Raise', 'corpo', null, [10, 10, 10], 'ok', 'Removido do plano (não gosto)'),
      ], 'Semana 21 · Dia C não feito esta semana'),
      hist('2026-05-26', 'Dia A — Quad + Push/Pull horizontal', [
        hx('Leg Press', 'maquina', null, [], null), hx('DB Bench Press', 'halteres', null, [], null),
        hx('DB Row 1-braço', 'halteres', null, [], null), hx('DB RDL', 'halteres', null, [], null),
        hx('DB Lateral Raise', 'halteres', null, [], null), hx('Cable Curl (corda)', 'maquina', null, [], null),
        hx('Plank frontal', 'tempo', null, [], null),
      ], 'Semana 22 · Registo sem detalhe de cargas — progressões a partir da S21'),
      hist('2026-05-28', 'Dia B — Posterior + Push/Pull vertical', [
        hx('DB RDL', 'halteres', null, [], null), hx('Lat Pulldown', 'maquina', null, [], null),
        hx('DB Shoulder Press', 'halteres', null, [], null), hx('Walking Lunges DB', 'halteres', null, [], 'hard', 'Dor no isquio direito 🔴'),
        hx('Face Pull', 'maquina', null, [], null), hx('Triceps Pushdown (corda)', 'maquina', null, [], null),
      ], 'Semana 22 · Registo sem detalhe de cargas'),
      hist('2026-05-29', 'Dia C — Misto', [
        hx('DB Bulgarian Split Squat', 'halteres', [8, 8, 8], [8, 8, 8], 'hard', 'Dor isquio direito 🔴'),
        hx('Incline DB Press', 'halteres', [8, 10, 12, 12], [12, 12, 12, 6], 'hard', 'Limite a 12 kg'),
        hx('Seated Cable Row', 'maquina', [10, 10, 11, 12], [12, 12, 12, 12], 'easy', 'Espaço p/ subir'),
        hx('Hip Thrust DB', 'halteres', [0, 10, 16], [12, 12, 12], 'ok'),
        hx('DB Lateral Raise', 'halteres', [6, 6, 7], [12, 10, 10], 'ok'),
        hx('Straight Bar Cable Curl', 'maquina', [5, 5, 6, 6], [12, 12, 12, 8], 'ok', 'Última à falha; posso subir'),
      ], 'Semana 22'),
      hist('2026-06-04', 'Dia A — Quad + Push/Pull horizontal', [
        hx('Leg Press', 'maquina', [9, 10, 11, 12], [10, 10, 10, 10], 'ok'),
        hx('DB Bench Press', 'halteres', [10, 12, 15], [12, 12, 12], 'easy', 'Próxima: 12/14/16'),
        hx('DB Row 1-braço', 'halteres', [10, 12, 15], [12, 12, 12], 'ok'),
        hx('DB RDL', 'halteres', [10, 12, 15], [12, 12, 12], 'ok', 'Leve desconforto na perna 🔴'),
        hx('DB Lateral Raise', 'halteres', [6, 7, 7], [12, 12, 10], 'ok'),
        hx('Cable Curl (corda)', 'maquina', [5, 6, 6], [12, 12, 12], 'ok', 'Desconforto na pega → trocar p/ barra reta'),
      ], 'Semana 23'),
      hist('2026-06-08', 'Dia A — Quad + Push/Pull horizontal', [
        hx('Leg Press', 'maquina', [10, 11, 12, 13], [12, 12, 12, 12], 'easy', 'Tranquilo'),
        hx('DB Bench Press', 'halteres', [12, 14, 16], [12, 12, 9], 'hard', '16 cortou — repetir antes de subir'),
        hx('DB Row 1-braço', 'halteres', [12, 14, 16], [12, 10, 10], 'ok', 'Técnica a vigiar; baixar p/ 14 se partir'),
        hx('DB RDL', 'halteres', [10, 12, 15], [12, 12, 12], 'ok', 'Sem desconforto ✅'),
        hx('DB Lateral Raise', 'halteres', [6, 7, 7], [12, 12, 12], 'easy', 'Próxima: 7/7/7'),
        hx('Straight Bar Cable Curl', 'maquina', [5, 6, 6], [12, 12, 12], 'ok'),
      ], 'Semana 24'),
    ],
    activeSession: null,
  };
}

/* ---------------- store ---------------- */
// remove duplicados: mesmo treino (data+nome) registado com ids diferentes
// (acontecia quando dois dispositivos arrancavam com o mesmo seed antes do sync)
function dedupeHistory(list) {
  const map = new Map();
  for (const h of list || []) {
    // cardio: 1 corrida por dia (cópias antigas tinham nomes/ids diferentes); ginásio: data+nome
    const k = h.type === 'cardio' ? `${h.date}|cardio` : `${h.date}|${h.name}`;
    const score = (h.exercises || []).reduce((t, e) => t + (e.sets || []).filter(st => st.done).length, 0)
      + (h.minutes ? 10 : 0) + (h.km ? 10 : 0);
    const prev = map.get(k);
    if (!prev || score > prev.score) map.set(k, { h, score });
  }
  return [...map.values()].map(x => x.h).sort((a, b) => a.date < b.date ? -1 : 1);
}
// notas do coach: uma por dia, ganha a mais completa (versões editadas do mesmo dia colapsam)
function dedupeNotes(list) {
  const map = new Map();
  for (const n of list || []) {
    const prev = map.get(n.date);
    if (!prev || (n.text || '').length > (prev.text || '').length) map.set(n.date, n);
  }
  return [...map.values()].sort((a, b) => a.date < b.date ? -1 : 1);
}
function migrate(s) {
  s.version = 3;
  s.updatedAt = s.updatedAt || new Date().toISOString();
  s.coachNotes = dedupeNotes(s.coachNotes || []);
  s.plan.days.forEach(d => {
    d.type = d.type || 'gym';
    d.exercises = d.exercises || [];
    if (d.type === 'cardio' && d.targetKm == null) d.targetKm = 3;
  });
  if (!s.plan.days.some(d => d.type === 'cardio'))
    s.plan.days.push({ id: 'dR', name: 'Corrida', type: 'cardio', weekdays: [], targetKm: 3, exercises: [] });
  s.history.forEach(h => {
    if (!h.type) h.type = (!h.exercises || !h.exercises.length) && /corrida|cardio/i.test(h.name) ? 'cardio' : 'gym';
  });
  s.health = s.health || { weights: [] }; // registos de peso: {date, kg, t} (t = timestamp p/ merge; kg null = apagado)
  s.deleted = s.deleted || []; // ids de treinos eliminados (para a eliminação propagar entre dispositivos)
  s.history = dedupeHistory(s.history.filter(h => !s.deleted.includes(h.id)));
  return s;
}
let state = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.error('load falhou', e); }
  return migrate(defaultState());
}
function save() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  schedulePush();
}

/* ---------------- sincronização (Supabase) ---------------- */
let syncCfg = null, syncTimer = null, syncStatus = 'off', syncMsg = '';
try { syncCfg = JSON.parse(localStorage.getItem('gymtrack-sync')); } catch (e) {}

function syncHeaders() {
  // chaves novas (sb_publishable_...) só usam o header apikey; as antigas (eyJ...) também vão no Authorization
  const h = { apikey: syncCfg.key, 'Content-Type': 'application/json' };
  if (syncCfg.key.startsWith('eyJ')) h.Authorization = 'Bearer ' + syncCfg.key;
  return h;
}
async function syncPull() {
  const r = await fetch(`${syncCfg.url}/rest/v1/gymtrack_state?id=eq.${encodeURIComponent(syncCfg.id)}&select=data`, { headers: syncHeaders() });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const rows = await r.json();
  return rows[0] ? rows[0].data : null;
}
async function syncPush() {
  if (!syncCfg) return;
  syncStatus = 'syncing'; updateSyncUi();
  try {
    const r = await fetch(`${syncCfg.url}/rest/v1/gymtrack_state`, {
      method: 'POST',
      headers: { ...syncHeaders(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ id: syncCfg.id, data: state, updated_at: new Date().toISOString() }]),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    syncStatus = 'ok';
    syncMsg = 'sincronizado às ' + new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { syncStatus = 'error'; syncMsg = e.message; }
  updateSyncUi();
}
function schedulePush() {
  if (!syncCfg) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncPush, 1500);
}
function mergeStates(local, remote) {
  if (!remote) return local;
  const base = (remote.updatedAt || '') > (local.updatedAt || '') ? remote : local;
  const deleted = [...new Set([...(local.deleted || []), ...(remote.deleted || [])])];
  const seen = new Set();
  const history = dedupeHistory(
    [...(local.history || []), ...(remote.history || [])]
      .filter(h => !deleted.includes(h.id))
      .filter(h => seen.has(h.id) ? false : (seen.add(h.id), true))
  );
  const coachNotes = dedupeNotes([...(local.coachNotes || []), ...(remote.coachNotes || [])]);
  // peso: um registo por dia, ganha o mais recente (t); kg null = apagado nesse dia
  const wMap = new Map();
  for (const w of [...((local.health || {}).weights || []), ...((remote.health || {}).weights || [])]) {
    const prev = wMap.get(w.date);
    if (!prev || (w.t || 0) > (prev.t || 0)) wMap.set(w.date, w);
  }
  const health = { weights: [...wMap.values()].sort((a, b) => a.date < b.date ? -1 : 1) };
  const merged = { ...base, history, coachNotes, deleted, health };
  if (local.activeSession) merged.activeSession = local.activeSession; // nunca perder treino em curso
  return merged;
}
async function syncStart() {
  if (!syncCfg) return;
  syncStatus = 'syncing'; updateSyncUi();
  try {
    const remote = await syncPull();
    state = migrate(mergeStates(state, remote));
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    render();
    await syncPush();
  } catch (e) { syncStatus = 'error'; syncMsg = e.message; updateSyncUi(); }
}
function syncLabel() {
  if (!syncCfg) return '⚪ não configurada';
  return { off: '🟡 ligada (à espera)', syncing: '🔄 a sincronizar…', ok: '🟢 ' + syncMsg, error: '🔴 erro: ' + syncMsg }[syncStatus];
}
function updateSyncUi() {
  const el = document.getElementById('sync-status');
  if (el) el.textContent = syncLabel();
}
function connectSync() {
  // aceitar URLs colados com /rest/v1/, barras finais ou espaços
  const url = document.getElementById('s-url').value.trim()
    .replace(/\/rest\/v1.*$/, '')
    .replace(/\/+$/, '');
  const key = document.getElementById('s-key').value.trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key) { alert('Confirma o URL (https://xxxx.supabase.co) e a chave.'); return; }
  syncCfg = { url, key, id: 'joao' };
  localStorage.setItem('gymtrack-sync', JSON.stringify(syncCfg));
  render();
  syncStart();
}
function disconnectSync() {
  if (!confirm('Desligar a sincronização neste dispositivo? Os dados locais mantêm-se.')) return;
  localStorage.removeItem('gymtrack-sync');
  syncCfg = null; syncStatus = 'off'; syncMsg = '';
  render();
}

/* ---------------- router ---------------- */
let route = 'today';
let calOffset = 0;
let progressEx = null;
let chart = null;
let planEdit = false;

function navigate(r) { if (r !== route) planEdit = false; route = r; render(); }
function render() {
  document.querySelectorAll('#tabs button').forEach(b =>
    b.classList.toggle('active', b.dataset.route === route));
  const v = document.getElementById('view');
  if (state.activeSession && route === 'today') v.innerHTML = viewSession();
  else v.innerHTML = ({ today: viewToday, calendar: viewCalendar, progress: viewProgress, health: viewHealth, plan: viewPlan, settings: viewSettings }[route])();
  if (route === 'progress') drawChart();
  if (route === 'health') drawWeightChart();
}

/* ---------------- vista: HOJE ---------------- */
function viewToday() {
  const dow = new Date().getDay();
  const suggested = state.plan.days.find(d => d.weekdays.includes(dow));
  const doneToday = state.history.some(h => h.date === todayKey() && h.type !== 'cardio');
  let html = `<h1>Olá, João! 💪</h1><p class="sub">${new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>`;

  if (doneToday) html += `<div class="card highlight"><h3>✅ Treino de hoje concluído</h3><p class="muted">Bom trabalho. Descansa e hidrata-te!</p></div>`;
  else if (suggested) html += dayCard(suggested, true);
  else html += `<div class="card"><h3>Dia de descanso 😴</h3><p class="muted">Não tens treino agendado para hoje, mas podes começar qualquer um abaixo.</p></div>`;

  const others = state.plan.days.filter(d => d !== suggested);
  if (others.length) {
    html += `<h2>Outros treinos</h2>`;
    html += others.map(d => dayCard(d, false)).join('');
  }

  const cn = (state.coachNotes || [])[state.coachNotes.length - 1];
  if (cn) {
    html += `<div class="card"><h3>🧠 Nota do coach</h3><p class="muted small">${fmtDate(cn.date)}</p>
      <p style="margin:6px 0 0;font-size:.92rem">${esc(cn.text)}</p>
      ${state.coachNotes.length > 1 ? `<button class="btn sm ghost" style="margin-top:8px" onclick="app.showCoachNotes()">Ver notas anteriores</button>` : ''}</div>`;
  }

  const last = state.history[state.history.length - 1];
  if (last) {
    const desc = last.type === 'cardio'
      ? [last.minutes ? `${last.minutes} min` : '', last.km ? `${last.km} km` : ''].filter(Boolean).join(' · ')
      : `${last.exercises.length} exercícios${volume(last) ? ` · ${volume(last).toLocaleString('pt-PT')} kg de volume` : ''}`;
    html += `<h2>Último treino</h2>
      <div class="card"><div class="row"><div><h3>${last.type === 'cardio' ? '🏃 ' : ''}${esc(last.name)}</h3>
      <p class="muted">${fmtDate(last.date)}${desc ? ' · ' + desc : ''}</p></div>
      <button class="btn sm" onclick="app.showWorkout('${last.id}')">Ver</button></div></div>`;
  }
  return html;
}
function showCoachNotes() {
  const notes = (state.coachNotes || []).slice().reverse();
  openModal(`<h3>🧠 Notas do coach</h3>
    ${notes.map(n => `<div class="summary-item"><b>${fmtDate(n.date)}</b><br><span class="muted">${esc(n.text)}</span></div>`).join('')}
    <button class="btn block" style="margin-top:14px" onclick="app.closeModal()">Fechar</button>`);
}
function dayCard(day, suggested) {
  if (day.type === 'cardio') {
    return `<div class="card ${suggested ? 'highlight' : ''}">
      <div class="row"><div>
        <h3>${suggested ? '⭐ ' : ''}🏃 ${esc(day.name)}</h3>
        <p class="muted">${day.targetKm ? `~${day.targetKm} km · ` : ''}${day.weekdays.map(w => WEEKDAYS[w]).join(', ') || 'quando quiseres'}</p>
      </div>
      <button class="btn ${suggested ? 'primary' : ''}" onclick="app.logCardio()">Registar</button></div>
    </div>`;
  }
  const adjs = day.exercises.filter(e => e.lastAdj).length;
  return `<div class="card ${suggested ? 'highlight' : ''}">
    <div class="row"><div>
      <h3>${suggested ? '⭐ ' : ''}${esc(day.name)}</h3>
      <p class="muted">${day.exercises.length} exercícios · ${day.weekdays.map(w => WEEKDAYS[w]).join(', ') || 'sem dia fixo'}</p>
      ${adjs ? `<span class="badge green">📈 ${adjs} sugestões do coach</span>` : ''}
    </div>
    <button class="btn ${suggested ? 'primary' : ''}" onclick="app.startWorkout('${day.id}')">Começar</button></div>
  </div>`;
}

/* ---------------- sessão de treino ---------------- */
function logCardio() {
  openModal(`<h3>🏃 Registar corrida</h3>
    <div class="form-grid">
      <label>Data<input id="c-date" type="date" value="${todayKey()}"></label>
      <label>Minutos<input id="c-min" type="number" inputmode="decimal" placeholder="25"></label>
      <label>Distância (km)<input id="c-km" type="number" step="0.1" inputmode="decimal" placeholder="3.0"></label>
      <label class="full">Notas<input id="c-notes" placeholder="ritmo, sensações, intervalos…"></label>
    </div>
    <div class="btnrow"><button class="btn" onclick="app.closeModal()">Cancelar</button>
    <button class="btn primary" onclick="app.saveCardio()">Guardar ✓</button></div>`);
}
function saveCardio() {
  const date = document.getElementById('c-date').value || todayKey();
  const minutes = parseFloat(document.getElementById('c-min').value) || 0;
  const km = parseFloat(document.getElementById('c-km').value) || 0;
  if (!minutes && !km) { alert('Indica pelo menos os minutos ou a distância.'); return; }
  state.history.push({
    id: uid(), type: 'cardio', planDayId: null, name: 'Corrida', date,
    startedAt: date + 'T12:00:00.000Z', finishedAt: date + 'T12:00:00.000Z',
    minutes, km, notes: document.getElementById('c-notes').value, exercises: [],
  });
  state.history.sort((a, b) => a.date < b.date ? -1 : 1);
  save(); closeModal(); render();
}
function startWorkout(dayId) {
  const day = state.plan.days.find(d => d.id === dayId);
  if (!day) return;
  if (day.type === 'cardio') { logCardio(); return; }
  state.activeSession = {
    id: uid(),
    planDayId: day.id,
    name: day.name,
    date: todayKey(),
    startedAt: new Date().toISOString(),
    notes: '',
    exercises: day.exercises.map(e => ({
      exId: e.id, name: e.name, equip: e.equip, repsMin: e.repsMin, repsMax: e.repsMax, increment: e.increment,
      lastAdj: e.lastAdj || '',
      feedback: null, note: '',
      sets: Array.from({ length: e.sets }, (_, j) => ({
        weight: e.weights && e.weights.length ? (e.weights[j] ?? e.weights[e.weights.length - 1]) : 0,
        reps: e.targetReps || e.repsMin,
        done: false,
      })),
    })),
  };
  save(); navigate('today');
}
function viewSession() {
  const s = state.activeSession;
  const mins = Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 60000);
  let html = `<h1>${esc(s.name)}</h1><p class="sub">Em curso · começou há ${mins} min</p>`;
  html += s.exercises.map((sx, i) => {
    const allDone = sx.sets.every(st => st.done);
    const showW = hasWeight(sx.equip);
    const unit = EQUIPS[sx.equip]?.unit || 'kg';
    return `<div class="ex-card ${allDone ? 'done-all' : ''}">
      <div class="ex-head"><h3>${esc(sx.name)}</h3>
        <span class="target">${sx.equip === 'tempo' ? `${sx.sets.length}× segundos` : `${sx.sets.length}×${sx.repsMin === sx.repsMax ? sx.repsMin : sx.repsMin + '–' + sx.repsMax}`}</span></div>
      ${sx.lastAdj ? `<div class="adj-note">💡 ${esc(sx.lastAdj)}</div>` : ''}
      <div class="set-row ${showW ? '' : 'now'}" style="margin-top:2px"><span class="setn"></span>${showW ? `<span class="setn">${unit}</span>` : ''}<span class="setn">${sx.equip === 'tempo' ? 'seg' : 'reps'}</span><span class="setn"></span></div>
      ${sx.sets.map((st, j) => `
        <div class="set-row ${showW ? '' : 'now'}">
          <span class="setn">${j + 1}</span>
          ${showW ? `<input type="number" inputmode="decimal" step="0.5" value="${st.weight}" onchange="app.setField(${i},${j},'weight',this.value)">` : ''}
          <input type="number" inputmode="numeric" value="${st.reps}" onchange="app.setField(${i},${j},'reps',this.value)">
          <button class="set-check ${st.done ? 'on' : ''}" onclick="app.toggleSet(${i},${j})">${st.done ? '✓' : '○'}</button>
        </div>`).join('')}
      <div class="fb-row">${FEEDBACKS.map(f =>
        `<button class="fb ${sx.feedback === f.id ? 'on-' + f.id : ''}" onclick="app.setFeedback(${i},'${f.id}')">${f.label}</button>`).join('')}
      </div>
      <input class="ex-note" placeholder="📝 Nota (técnica, dores…)" value="${esc(sx.note || '')}" onchange="app.setExNote(${i},this.value)">
    </div>`;
  }).join('');
  html += `<div class="card"><h3>Notas do treino</h3>
    <textarea placeholder="Como te sentiste, observações gerais…" onchange="app.setNotes(this.value)">${esc(s.notes)}</textarea></div>`;
  html += `<div class="btnrow">
    <button class="btn danger" onclick="app.cancelWorkout()">Cancelar</button>
    <button class="btn primary" onclick="app.finishWorkout()">Terminar treino ✓</button></div>`;
  return html;
}
function setField(i, j, field, value) {
  state.activeSession.exercises[i].sets[j][field] = parseFloat(value) || 0;
  save();
}
function toggleSet(i, j) {
  const st = state.activeSession.exercises[i].sets[j];
  st.done = !st.done;
  save(); render();
  if (st.done) startRestTimer();
}
function setFeedback(i, fb) {
  const sx = state.activeSession.exercises[i];
  sx.feedback = sx.feedback === fb ? null : fb;
  save(); render();
}
function setExNote(i, v) { state.activeSession.exercises[i].note = v; save(); }
function setNotes(v) { state.activeSession.notes = v; save(); }
function cancelWorkout() {
  if (!confirm('Cancelar o treino em curso? Os dados desta sessão perdem-se.')) return;
  state.activeSession = null; stopRestTimer(); save(); render();
}

/* ---------------- progressão automática ---------------- */
function finishWorkout() {
  const s = state.activeSession;
  const anyDone = s.exercises.some(sx => sx.sets.some(st => st.done));
  if (!anyDone && !confirm('Não marcaste nenhuma série como feita. Terminar mesmo assim?')) return;

  s.finishedAt = new Date().toISOString();
  const day = state.plan.days.find(d => d.id === s.planDayId);
  const summary = [];

  s.exercises.forEach(sx => {
    const planEx = day && day.exercises.find(e => e.id === sx.exId);
    if (!planEx) return;
    const done = sx.sets.filter(st => st.done);
    if (!done.length) return;

    // sincronizar cargas do plano com o que foi realmente usado
    if (hasWeight(planEx.equip)) planEx.weights = sx.sets.map(st => st.weight);

    const eq = EQUIPS[planEx.equip] || EQUIPS.halteres;
    const hitAllMax = done.length >= planEx.sets && done.every(st => st.reps >= planEx.repsMax);
    const fb = sx.feedback || 'ok';
    let adj, cls;

    if (fb === 'fail') {
      planEx.failStreak = (planEx.failStreak || 0) + 1;
      if (planEx.failStreak >= 2 && hasWeight(planEx.equip)) {
        const old = planEx.weights.join('/');
        planEx.weights = planEx.weights.map(w => roundStep(w * 0.9, eq.step));
        adj = `Deload: ${old} → ${planEx.weights.join('/')} ${eq.unit} (2 falhas seguidas)`;
        planEx.failStreak = 0; planEx.targetReps = planEx.repsMin; cls = 'down';
      } else { adj = 'Manter carga (recuperar da falha)'; cls = 'keep'; }
    } else {
      planEx.failStreak = 0;
      if (planEx.equip === 'tempo') {
        if (fb === 'easy' || hitAllMax) {
          planEx.targetReps = Math.min((planEx.targetReps || planEx.repsMin) + (planEx.increment || 15), planEx.repsMax);
          adj = `Próximo alvo: ${planEx.targetReps}s por série`; cls = 'up';
        } else { adj = 'Manter tempo'; cls = 'keep'; }
      } else if (hitAllMax && fb !== 'hard') {
        if (hasWeight(planEx.equip)) {
          const old = planEx.weights.join('/');
          planEx.weights = planEx.weights.map(w => +(w + planEx.increment).toFixed(2));
          adj = `Subir carga: ${old} → ${planEx.weights.join('/')} ${eq.unit} 🎉`;
        } else adj = 'No topo do alvo — considerar dificultar 🎉';
        planEx.targetReps = planEx.repsMin; cls = 'up';
      } else if (hitAllMax && fb === 'hard') {
        adj = 'Consolidar: repetir antes de subir'; cls = 'keep';
      } else if (fb === 'easy') {
        planEx.targetReps = Math.min((planEx.targetReps || planEx.repsMin) + 1, planEx.repsMax);
        adj = planEx.repsMin === planEx.repsMax ? 'Foi fácil — para a próxima, subir carga se repetir' : `Próximo alvo: ${planEx.targetReps} reps por série`;
        cls = 'up';
      } else if (fb === 'hard') {
        adj = 'Manter carga e reps'; cls = 'keep';
      } else {
        const best = Math.max(...done.map(st => st.reps));
        planEx.targetReps = Math.min(Math.max(planEx.targetReps || planEx.repsMin, best + 1), planEx.repsMax);
        adj = `Próximo alvo: ${planEx.targetReps} reps por série`; cls = 'up';
      }
    }
    planEx.lastAdj = adj;
    summary.push({ name: sx.name, adj, cls });
  });

  state.history.push(s);
  state.activeSession = null;
  stopRestTimer(); save();

  openModal(`<h3>Treino concluído! 🎉</h3>
    <p class="muted">Sugestões para o próximo treino:</p>
    ${summary.length ? summary.map(x => `<div class="summary-item"><b>${esc(x.name)}</b><br><span class="${x.cls}">${esc(x.adj)}</span></div>`).join('') : '<p class="muted">Sem séries registadas.</p>'}
    <button class="btn primary block" style="margin-top:16px" onclick="app.closeModal()">Fechar</button>`);
  render();
}

/* ---------------- timer de descanso ---------------- */
let timerInterval = null, timerLeft = 0;
function startRestTimer() {
  timerLeft = state.settings.restSeconds || 90;
  const bar = document.getElementById('timerbar');
  bar.classList.remove('hidden');
  clearInterval(timerInterval);
  const tick = () => {
    if (timerLeft <= 0) { stopRestTimer(); try { navigator.vibrate && navigator.vibrate(300); } catch (e) {} return; }
    bar.innerHTML = `<span>⏱️ Descanso: ${Math.floor(timerLeft / 60)}:${String(timerLeft % 60).padStart(2, '0')}</span>
      <button onclick="app.stopRestTimer()">Saltar</button>`;
    timerLeft--;
  };
  tick();
  timerInterval = setInterval(tick, 1000);
}
function stopRestTimer() {
  clearInterval(timerInterval);
  document.getElementById('timerbar').classList.add('hidden');
}

/* ---------------- vista: CALENDÁRIO ---------------- */
function viewCalendar() {
  const base = new Date();
  const m = new Date(base.getFullYear(), base.getMonth() + calOffset, 1);
  const monthName = m.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  const firstDow = m.getDay();
  const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const byDate = {};
  state.history.forEach(h => { (byDate[h.date] = byDate[h.date] || []).push(h); });

  let cells = WEEKDAYS.map(d => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < firstDow; i++) cells += `<div class="cal-day out"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = todayKey(new Date(m.getFullYear(), m.getMonth(), d));
    const trained = byDate[key];
    const isToday = key === todayKey();
    const hasGym = trained && trained.some(h => h.type !== 'cardio');
    const hasRun = trained && trained.some(h => h.type === 'cardio');
    const cls = trained ? (hasGym && hasRun ? 'mixed' : (hasRun ? 'cardio' : 'trained')) : '';
    cells += `<div class="cal-day ${cls} ${isToday ? 'today' : ''}"
      ${trained ? `onclick="app.showDay('${key}')"` : ''}>
      ${d}${trained ? '<span class="dot">●</span>' : ''}</div>`;
  }
  return `<h1>Calendário</h1><p class="sub">Os teus dias de treino</p>
    <div class="cal-head">
      <button class="btn sm" onclick="app.calMove(-1)">‹</button>
      <b style="text-transform:capitalize">${monthName}</b>
      <button class="btn sm" onclick="app.calMove(1)">›</button>
    </div>
    <div class="cal-grid">${cells}</div>`;
}
function calMove(n) { calOffset += n; render(); }
function streak() {
  if (!state.history.length) return 0;
  const weeks = new Set(state.history.map(h => {
    const d = new Date(h.date + 'T12:00:00');
    const onejan = new Date(d.getFullYear(), 0, 1);
    return d.getFullYear() + '-' + Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  }));
  let count = 0;
  const now = new Date();
  for (let i = 0; i < 104; i++) {
    const d = new Date(now.getTime() - i * 7 * 86400000);
    const onejan = new Date(d.getFullYear(), 0, 1);
    const wk = d.getFullYear() + '-' + Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    if (weeks.has(wk)) count++;
    else if (i > 0) break;
  }
  return count;
}
function setDisplay(sx, st) {
  if (sx.equip === 'tempo') return `${st.reps}s`;
  if (sx.equip === 'corpo') return `×${st.reps}`;
  if (sx.equip === 'maquina') return `nív.${st.weight}×${st.reps}`;
  return `${st.weight}kg×${st.reps}`;
}
function showDay(dateKey) {
  const entries = state.history.filter(h => h.date === dateKey);
  if (!entries.length) return;
  if (entries.length === 1) { showWorkout(entries[0].id); return; }
  openModal(`<h3>${fmtDate(dateKey)}</h3><p class="muted">${entries.length} treinos neste dia</p>
    ${entries.map(h => {
      const desc = h.type === 'cardio'
        ? [h.minutes ? `${h.minutes} min` : '', h.km ? `${h.km} km` : ''].filter(Boolean).join(' · ')
        : `${h.exercises.length} exercícios`;
      return `<div class="summary-item row"><div><b>${h.type === 'cardio' ? '🏃' : '🏋️'} ${esc(h.name)}</b><br>
        <span class="muted">${desc}</span></div>
        <button class="btn sm" onclick="app.showWorkout('${h.id}')">Ver</button></div>`;
    }).join('')}
    <button class="btn block" style="margin-top:14px" onclick="app.closeModal()">Fechar</button>`);
}
function showWorkout(id) {
  const h = state.history.find(x => x.id === id);
  if (!h) return;
  if (h.type === 'cardio') {
    const pace = h.minutes && h.km ? h.minutes / h.km : null;
    openModal(`<h3>🏃 ${esc(h.name)}</h3><p class="muted">${fmtDate(h.date)}</p>
      <div class="stats" style="margin-top:12px;grid-template-columns:1fr 1fr">
        <div class="stat"><div class="v">${h.minutes || '—'}</div><div class="l">minutos</div></div>
        <div class="stat"><div class="v">${h.km || '—'}</div><div class="l">km</div></div>
      </div>
      ${pace ? `<p class="muted">Ritmo: ${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, '0')} min/km</p>` : ''}
      ${h.notes ? `<p class="muted">📝 ${esc(h.notes)}</p>` : ''}
      <div class="btnrow"><button class="btn danger" onclick="app.deleteWorkout('${h.id}')">🗑️ Eliminar</button>
      <button class="btn" onclick="app.closeModal()">Fechar</button></div>`);
    return;
  }
  const vol = volume(h);
  openModal(`<h3>${esc(h.name)}</h3><p class="muted">${fmtDate(h.date)}${vol ? ` · volume ${vol.toLocaleString('pt-PT')} kg` : ''}</p>
    ${h.exercises.map(sx => `<div class="summary-item"><b>${esc(sx.name)}</b> ${sx.feedback ? FEEDBACKS.find(f => f.id === sx.feedback)?.label.split(' ')[0] : ''}<br>
      <span class="muted">${sx.sets.filter(s => s.done).map(s => setDisplay(sx, s)).join(' · ') || 'sem detalhe registado'}</span>
      ${sx.note ? `<br><span class="muted small">📝 ${esc(sx.note)}</span>` : ''}</div>`).join('')}
    ${h.notes ? `<p class="muted">📝 ${esc(h.notes)}</p>` : ''}
    <div class="btnrow" style="margin-top:14px"><button class="btn danger" onclick="app.deleteWorkout('${h.id}')">🗑️ Eliminar</button>
    <button class="btn" onclick="app.closeModal()">Fechar</button></div>`);
}
function deleteWorkout(id) {
  const h = state.history.find(x => x.id === id);
  if (!h) return;
  if (!confirm(`Eliminar "${h.name}" de ${fmtDate(h.date)}? Esta ação propaga-se a todos os dispositivos.`)) return;
  state.history = state.history.filter(x => x.id !== id);
  state.deleted = state.deleted || [];
  state.deleted.push(id);
  save(); closeModal(); render();
}
function volume(h) {
  return Math.round(h.exercises.reduce((t, sx) =>
    hasWeight(sx.equip) && sx.equip !== 'maquina'
      ? t + sx.sets.filter(s => s.done).reduce((a, s) => a + s.weight * s.reps, 0)
      : t, 0));
}

/* ---------------- vista: PROGRESSO ---------------- */
function exerciseEquip(name) {
  for (const d of state.plan.days) { const e = d.exercises.find(x => x.name === name); if (e) return e.equip; }
  for (const h of state.history) { const e = h.exercises.find(x => x.name === name); if (e) return e.equip; }
  return 'halteres';
}
const CORRIDA = '🏃 Corrida';
function allExerciseNames() {
  const names = new Set();
  state.plan.days.forEach(d => d.exercises.forEach(e => names.add(e.name)));
  state.history.forEach(h => h.exercises.forEach(e => names.add(e.name)));
  return [CORRIDA, ...names];
}
function isoWeek(d0) {
  const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), 12);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4, 12);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
function weekMonday(offsetWeeks = 0) {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - offsetWeeks * 7);
  return d;
}
function weekKeyOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return todayKey(d);
}
function viewProgress() {
  const names = allExerciseNames();
  if (!progressEx || !names.includes(progressEx)) progressEx = names[0] || null;
  const days30 = h => (Date.now() - new Date(h.date + 'T12:00:00')) / 86400000 <= 30;
  const gym30 = state.history.filter(h => h.type !== 'cardio' && days30(h)).length;
  const runs30 = state.history.filter(h => h.type === 'cardio' && days30(h));
  const km30 = runs30.reduce((t, h) => t + (h.km || 0), 0);
  const isRun = progressEx === CORRIDA;
  const unit = isRun ? 'km' : (EQUIPS[exerciseEquip(progressEx)]?.unit || 'kg');
  return `<h1>Progresso</h1><p class="sub">A tua evolução ao longo do tempo</p>
    <h2 style="margin-top:4px">Visão geral</h2>
    <div class="stats">
      <div class="stat"><div class="v">${gym30}</div><div class="l">treinos de ginásio · 30 dias</div></div>
      <div class="stat"><div class="v">${runs30.length}</div><div class="l">corridas · 30 dias</div></div>
      <div class="stat"><div class="v">${km30 ? km30.toLocaleString('pt-PT') : 0}</div><div class="l">km corridos · 30 dias</div></div>
      <div class="stat"><div class="v">${streak()}</div><div class="l">semanas seguidas ativas</div></div>
    </div>
    <div class="chart-wrap"><canvas id="chart-weeks" height="180"></canvas></div>
    <p class="muted small" style="margin-top:8px">Treinos por semana (número da semana): verde ginásio · azul corrida</p>
    <h2>Por exercício</h2>
    <select onchange="app.pickExercise(this.value)">${names.map(n => `<option ${n === progressEx ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    <div class="chart-wrap"><canvas id="chart" height="220"></canvas></div>
    <p class="muted small" style="margin-top:8px">${isRun
      ? 'Barras azuis: km por corrida · Linha verde: ritmo (min/km, mais baixo = melhor)'
      : `Linha verde: carga máxima por sessão (${unit}) · Linha azul: volume da sessão`}</p>`;
}
function pickExercise(n) { progressEx = n; render(); }
let chartW = null;
function drawWeeksChart() {
  const cv = document.getElementById('chart-weeks');
  if (!cv || !window.Chart) return;
  const labels = [], gymC = [], runC = [];
  for (let i = 7; i >= 0; i--) {
    const mon = weekMonday(i);
    const wk = todayKey(mon);
    labels.push(String(isoWeek(mon)));
    gymC.push(state.history.filter(h => h.type !== 'cardio' && weekKeyOf(h.date) === wk).length);
    runC.push(state.history.filter(h => h.type === 'cardio' && weekKeyOf(h.date) === wk).length);
  }
  if (chartW) { chartW.destroy(); chartW = null; }
  chartW = new Chart(cv, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Ginásio', data: gymC, backgroundColor: '#16a34a', borderRadius: 4 },
      { label: 'Corrida', data: runC, backgroundColor: '#2563eb', borderRadius: 4 },
    ]},
    options: {
      responsive: true,
      scales: {
        x: { stacked: true, ticks: { color: '#9aa3b5' }, grid: { display: false } },
        y: { stacked: true, ticks: { color: '#9aa3b5', stepSize: 1 }, grid: { color: '#2e3442' } },
      },
      plugins: { legend: { labels: { color: '#e8eaf0' } } },
    },
  });
}
function drawChart() {
  drawWeeksChart();
  const cv = document.getElementById('chart');
  if (!cv || !window.Chart) return;
  if (progressEx === CORRIDA) {
    const runs = state.history.filter(h => h.type === 'cardio' && (h.km || h.minutes));
    if (chart) { chart.destroy(); chart = null; }
    if (!runs.length) return;
    chart = new Chart(cv, {
      data: {
        labels: runs.map(r => fmtDateShort(r.date)),
        datasets: [
          { type: 'line', label: 'Ritmo (min/km)', data: runs.map(r => r.km && r.minutes ? +(r.minutes / r.km).toFixed(2) : null), borderColor: '#4ade80', backgroundColor: '#4ade8033', tension: .3, yAxisID: 'y1' },
          { type: 'bar', label: 'Distância (km)', data: runs.map(r => r.km || null), backgroundColor: '#2563eb', borderRadius: 4, yAxisID: 'y' },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { ticks: { color: '#9aa3b5' }, grid: { color: '#2e3442' }, title: { display: true, text: 'km', color: '#9aa3b5' } },
          y1: { position: 'right', ticks: { color: '#9aa3b5' }, grid: { display: false }, title: { display: true, text: 'min/km', color: '#9aa3b5' } },
          x: { ticks: { color: '#9aa3b5' }, grid: { display: false } },
        },
        plugins: { legend: { labels: { color: '#e8eaf0' } } },
      },
    });
    return;
  }
  const equip = exerciseEquip(progressEx);
  const unit = EQUIPS[equip]?.unit || 'kg';
  const points = state.history
    .map(h => ({ h, sx: h.exercises.find(e => e.name === progressEx) }))
    .filter(x => x.sx && x.sx.sets.some(s => s.done))
    .map(x => ({
      date: x.h.date,
      max: equip === 'tempo' || equip === 'corpo'
        ? Math.max(...x.sx.sets.filter(s => s.done).map(s => s.reps))
        : Math.max(...x.sx.sets.filter(s => s.done).map(s => s.weight)),
      vol: x.sx.sets.filter(s => s.done).reduce((a, s) => a + (hasWeight(equip) ? s.weight * s.reps : s.reps), 0),
    }));
  if (chart) { chart.destroy(); chart = null; }
  if (!points.length) return;
  chart = new Chart(cv, {
    type: 'line',
    data: {
      labels: points.map(p => fmtDateShort(p.date)),
      datasets: [
        { label: equip === 'tempo' ? 'Tempo máx (s)' : equip === 'corpo' ? 'Reps máx' : `Carga máx (${unit})`, data: points.map(p => p.max), borderColor: '#4ade80', backgroundColor: '#4ade8033', tension: .3, yAxisID: 'y' },
        { label: 'Volume da sessão', data: points.map(p => p.vol), borderColor: '#60a5fa', backgroundColor: '#60a5fa22', tension: .3, yAxisID: 'y1' },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: { ticks: { color: '#9aa3b5' }, grid: { color: '#2e3442' } },
        y1: { position: 'right', ticks: { color: '#9aa3b5' }, grid: { display: false } },
        x: { ticks: { color: '#9aa3b5' }, grid: { display: false } },
      },
      plugins: { legend: { labels: { color: '#e8eaf0' } } },
    },
  });
}

/* ---------------- vista: PLANO ---------------- */
function viewPlan() {
  return `<div class="row"><h1>Plano de treino</h1>
      <button class="btn sm ${planEdit ? 'primary' : ''}" onclick="app.togglePlanEdit()">${planEdit ? '✓ Concluir' : '✏️ Editar'}</button></div>
    <p class="sub">Full Body 3×/semana${planEdit ? ' · modo de edição' : ''}</p>
    ${state.plan.days.map(d => `
      <div class="card plan-day ${d.type === 'cardio' ? 'is-cardio' : ''}">
        <div class="row plan-head">
          <h3>${d.type === 'cardio' ? '🏃' : '🏋️'} ${esc(d.name)}</h3>
          ${planEdit
            ? `<div class="nowrap"><button class="btn sm" onclick="app.renameDay('${d.id}')">✏️</button>
               <button class="btn sm danger" onclick="app.removeDay('${d.id}')">🗑️</button></div>`
            : (d.weekdays.length ? `<span class="plan-when">${d.weekdays.map(w => WEEKDAYS[w]).join(' · ')}</span>` : '')}
        </div>
        ${planEdit ? `<div class="chips">${WEEKDAYS.map((w, i) =>
          `<span class="chip ${d.weekdays.includes(i) ? 'on' : ''}" onclick="app.toggleWeekday('${d.id}',${i})">${w}</span>`).join('')}</div>` : ''}
        ${d.type === 'cardio'
          ? `<p class="muted small" style="margin:10px 0 4px">${d.targetKm ? `Alvo: ~${d.targetKm} km por corrida.` : 'Sem distância alvo definida.'} Ao registar indicas os km e o tempo.</p>
             ${planEdit ? `<button class="btn sm ghost" onclick="app.setCardioTarget('${d.id}')">Definir distância alvo</button>` : ''}`
          : `<div class="plan-list">${d.exercises.map((e, i) => `
          <div class="plan-ex">
            <span class="ex-num">${i + 1}</span>
            <div class="info"><b>${esc(e.name)}</b>
              <div>${EQUIPS[e.equip]?.label || e.equip} · ${repsLabel(e)}${hasWeight(e.equip) ? ' · ' + weightsLabel(e) : ''}</div></div>
            ${planEdit ? `<div class="nowrap"><button class="btn sm icon" onclick="app.moveExercise('${d.id}','${e.id}',-1)">↑</button><button class="btn sm icon" onclick="app.moveExercise('${d.id}','${e.id}',1)">↓</button><button class="btn sm icon" onclick="app.editExercise('${d.id}','${e.id}')">✏️</button><button class="btn sm icon danger" onclick="app.removeExercise('${d.id}','${e.id}')">✕</button></div>` : ''}
          </div>`).join('')}</div>
        ${planEdit ? `<button class="btn sm block ghost" style="margin-top:10px" onclick="app.editExercise('${d.id}',null)">+ Adicionar exercício</button>` : ''}`}
      </div>`).join('')}
    ${planEdit ? `<button class="btn block" onclick="app.addDay()">+ Adicionar treino</button>` : ''}`;
}
function togglePlanEdit() { planEdit = !planEdit; render(); }
function setCardioTarget(dayId) {
  const d = state.plan.days.find(x => x.id === dayId);
  const v = prompt('Distância alvo da corrida (km):', d.targetKm || 3);
  if (v === null) return;
  d.targetKm = parseFloat(String(v).replace(',', '.')) || 0;
  save(); render();
}
function addDay() {
  openModal(`<h3>Novo treino</h3>
    <div class="form-grid">
      <label class="full">Nome<input id="d-name" placeholder="Dia D — Ombros / Corrida longa"></label>
      <label class="full">Tipo
        <select id="d-type">
          <option value="gym">🏋️ Ginásio (exercícios e séries)</option>
          <option value="cardio">🏃 Corrida / cardio (minutos e km)</option>
        </select></label>
    </div>
    <div class="btnrow"><button class="btn" onclick="app.closeModal()">Cancelar</button>
    <button class="btn primary" onclick="app.saveDay()">Criar</button></div>`);
}
function saveDay() {
  const name = document.getElementById('d-name').value.trim();
  if (!name) { alert('Dá um nome ao treino.'); return; }
  const type = document.getElementById('d-type').value;
  state.plan.days.push({ id: uid(), name, type, weekdays: [], exercises: [], ...(type === 'cardio' ? { targetKm: 3 } : {}) });
  save(); closeModal(); render();
}
function renameDay(id) {
  const d = state.plan.days.find(x => x.id === id);
  const name = prompt('Novo nome:', d.name);
  if (name) { d.name = name; save(); render(); }
}
function removeDay(id) {
  if (!confirm('Remover este treino do plano? (o histórico mantém-se)')) return;
  state.plan.days = state.plan.days.filter(d => d.id !== id);
  save(); render();
}
function toggleWeekday(dayId, w) {
  const d = state.plan.days.find(x => x.id === dayId);
  d.weekdays = d.weekdays.includes(w) ? d.weekdays.filter(x => x !== w) : [...d.weekdays, w].sort();
  save(); render();
}
function editExercise(dayId, exId) {
  const d = state.plan.days.find(x => x.id === dayId);
  const e = exId ? d.exercises.find(x => x.id === exId)
    : { name: '', equip: 'halteres', sets: 3, repsMin: 10, repsMax: 12, weights: [10, 10, 10], increment: 2 };
  openModal(`<h3>${exId ? 'Editar' : 'Novo'} exercício</h3>
    <div class="form-grid">
      <label class="full">Nome<input id="f-name" value="${esc(e.name)}"></label>
      <label class="full">Equipamento
        <select id="f-equip" onchange="app.equipChanged(this.value)">
          ${Object.entries(EQUIPS).map(([k, v]) => `<option value="${k}" ${e.equip === k ? 'selected' : ''}>${v.label}${v.unit ? ` (${v.unit})` : ''}</option>`).join('')}
        </select></label>
      <label>Séries<input id="f-sets" type="number" value="${e.sets}"></label>
      <label id="f-weights-wrap" class="${hasWeight(e.equip) ? '' : 'hidden'}">Carga por série (ex: 12/14/16)<input id="f-weights" value="${(e.weights || []).join('/')}"></label>
      <label>${e.equip === 'tempo' ? 'Segundos mín' : 'Reps mín'}<input id="f-min" type="number" value="${e.repsMin}"></label>
      <label>${e.equip === 'tempo' ? 'Segundos máx' : 'Reps máx'}<input id="f-max" type="number" value="${e.repsMax}"></label>
      <label class="full">Incremento quando progrides (kg / níveis / segundos)<input id="f-inc" type="number" step="0.5" value="${e.increment}"></label>
    </div>
    <div class="btnrow">
      <button class="btn" onclick="app.closeModal()">Cancelar</button>
      <button class="btn primary" onclick="app.saveExercise('${dayId}','${exId || ''}')">Guardar</button>
    </div>`);
}
function equipChanged(equip) {
  document.getElementById('f-weights-wrap').classList.toggle('hidden', !hasWeight(equip));
}
function parseWeights(text, sets) {
  const arr = String(text).split(/[\/,;\s]+/).map(parseFloat).filter(n => !isNaN(n));
  if (!arr.length) arr.push(0);
  while (arr.length < sets) arr.push(arr[arr.length - 1]);
  return arr.slice(0, sets);
}
function saveExercise(dayId, exId) {
  const d = state.plan.days.find(x => x.id === dayId);
  const g = id => document.getElementById(id).value;
  const sets = parseInt(g('f-sets')) || 3;
  const equip = g('f-equip');
  const data = {
    name: g('f-name').trim() || 'Exercício',
    equip, sets,
    repsMin: parseInt(g('f-min')) || 8,
    repsMax: parseInt(g('f-max')) || 12,
    weights: hasWeight(equip) ? parseWeights(g('f-weights'), sets) : [],
    increment: parseFloat(g('f-inc')) || (equip === 'maquina' ? 1 : equip === 'tempo' ? 15 : 2),
  };
  if (exId) {
    const e = d.exercises.find(x => x.id === exId);
    Object.assign(e, data);
    e.targetReps = Math.min(Math.max(e.targetReps || data.repsMin, data.repsMin), data.repsMax);
  } else d.exercises.push({ id: uid(), ...data, targetReps: equip === 'tempo' ? 45 : data.repsMin, failStreak: 0, lastAdj: '' });
  save(); closeModal(); render();
}
function removeExercise(dayId, exId) {
  const d = state.plan.days.find(x => x.id === dayId);
  d.exercises = d.exercises.filter(e => e.id !== exId);
  save(); render();
}
function moveExercise(dayId, exId, dir) {
  const d = state.plan.days.find(x => x.id === dayId);
  const i = d.exercises.findIndex(e => e.id === exId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= d.exercises.length) return;
  [d.exercises[i], d.exercises[j]] = [d.exercises[j], d.exercises[i]];
  save(); render();
}

/* ---------------- vista: SAÚDE ---------------- */
let chartH = null;
function weightEntries() {
  return ((state.health || {}).weights || []).filter(w => w.kg != null);
}
function viewHealth() {
  const ws = weightEntries();
  const last = ws[ws.length - 1];
  const first = ws[0];
  const diff = last && first && ws.length > 1 ? +(last.kg - first.kg).toFixed(1) : null;
  return `<h1>Saúde</h1><p class="sub">Peso e bem-estar</p>
    <div class="card"><h3>⚖️ Peso corporal</h3>
      <div class="weight-form">
        <input id="w-date" type="date" value="${todayKey()}">
        <input id="w-kg" type="number" step="0.1" inputmode="decimal" placeholder="kg">
        <button class="btn primary" onclick="app.addWeight()">Guardar</button>
      </div>
      ${last ? `<div class="stats" style="margin-top:14px;grid-template-columns:1fr 1fr">
        <div class="stat"><div class="v">${last.kg}</div><div class="l">kg · ${fmtDate(last.date)}</div></div>
        <div class="stat"><div class="v">${diff === null ? '—' : (diff > 0 ? '+' : '') + diff}</div><div class="l">kg desde ${first ? fmtDate(first.date) : '—'}</div></div>
      </div>` : '<p class="muted" style="margin-top:12px">Regista o teu primeiro peso para começares a acompanhar.</p>'}
      ${ws.length ? `<div class="chart-wrap" style="margin-top:12px"><canvas id="chart-weight" height="200"></canvas></div>` : ''}
      ${ws.length ? `<div style="margin-top:10px">${ws.slice(-5).reverse().map(w => `
        <div class="summary-item row"><span>${fmtDate(w.date)} — <b>${w.kg} kg</b></span>
        <button class="btn sm icon danger" onclick="app.deleteWeight('${w.date}')">✕</button></div>`).join('')}</div>` : ''}
    </div>
    <div class="card"><h3>🍎 Alimentação</h3>
      <div class="dev-box">🚧 Em desenvolvimento</div>
    </div>`;
}
function addWeight() {
  const date = document.getElementById('w-date').value || todayKey();
  const kg = parseFloat(String(document.getElementById('w-kg').value).replace(',', '.'));
  if (!kg || kg < 20 || kg > 300) { alert('Indica um peso válido em kg.'); return; }
  state.health = state.health || { weights: [] };
  state.health.weights = state.health.weights.filter(w => w.date !== date);
  state.health.weights.push({ date, kg: +kg.toFixed(1), t: Date.now() });
  state.health.weights.sort((a, b) => a.date < b.date ? -1 : 1);
  save(); render();
}
function deleteWeight(date) {
  if (!confirm(`Apagar o registo de peso de ${fmtDate(date)}?`)) return;
  state.health.weights = state.health.weights.filter(w => w.date !== date);
  state.health.weights.push({ date, kg: null, t: Date.now() });
  save(); render();
}
function drawWeightChart() {
  const cv = document.getElementById('chart-weight');
  if (!cv || !window.Chart) return;
  const ws = weightEntries();
  if (chartH) { chartH.destroy(); chartH = null; }
  if (!ws.length) return;
  chartH = new Chart(cv, {
    type: 'line',
    data: {
      labels: ws.map(w => fmtDateShort(w.date)),
      datasets: [{ label: 'Peso (kg)', data: ws.map(w => w.kg), borderColor: '#f472b6', backgroundColor: '#f472b633', tension: .3, fill: true }],
    },
    options: {
      responsive: true,
      scales: {
        y: { ticks: { color: '#9aa3b5' }, grid: { color: '#2e3442' } },
        x: { ticks: { color: '#9aa3b5' }, grid: { display: false } },
      },
      plugins: { legend: { labels: { color: '#e8eaf0' } } },
    },
  });
}

/* ---------------- vista: DEFINIÇÕES ---------------- */
function viewSettings() {
  return `<h1>Definições</h1><p class="sub">Dados e preferências</p>
    <div class="card"><h3>☁️ Sincronização</h3>
      <p class="muted">Liga os teus dispositivos à mesma base de dados (Supabase) — o que registas num aparece no outro. Estado: <b id="sync-status">${syncLabel()}</b></p>
      ${syncCfg
        ? `<div class="btnrow">
            <button class="btn" onclick="app.syncNow()">Sincronizar agora</button>
            <button class="btn danger" onclick="app.disconnectSync()">Desligar</button></div>`
        : `<div class="form-grid">
            <label class="full">URL do projeto<input id="s-url" placeholder="https://xxxx.supabase.co"></label>
            <label class="full">Chave (publishable / anon)<input id="s-key" placeholder="sb_publishable_… ou eyJ…"></label>
          </div>
          <button class="btn primary block" onclick="app.connectSync()">Ligar e sincronizar</button>`}
    </div>
    <div class="card"><h3>⏱️ Descanso entre séries</h3>
      <p class="muted">Segundos de descanso quando marcas uma série como feita.</p>
      <select onchange="app.setRest(this.value)">${[60, 90, 120, 150, 180].map(s =>
        `<option value="${s}" ${state.settings.restSeconds === s ? 'selected' : ''}>${s} segundos</option>`).join('')}</select></div>
    <div class="card"><h3>💾 Backup dos dados</h3>
      <p class="muted">Exporta os teus dados para um ficheiro JSON (guarda-o em segurança) ou importa um backup anterior. Usa também o export para me trazeres os dados para revisão de coach.</p>
      <div class="btnrow">
        <button class="btn" onclick="app.exportData()">Exportar</button>
        <button class="btn" onclick="document.getElementById('import-file').click()">Importar</button>
      </div>
      <input type="file" id="import-file" accept=".json" class="hidden" onchange="app.importData(this)"></div>
    <div class="card"><h3>📱 Instalar no iPhone</h3>
      <p class="muted">Abre esta app no Safari → botão Partilhar → "Adicionar ao ecrã principal". Fica com ícone próprio e funciona offline.</p></div>
    <div class="card"><h3>🗑️ Apagar tudo</h3>
      <p class="muted">Remove todos os dados (plano e histórico) deste dispositivo e repõe o plano inicial.</p>
      <button class="btn danger" onclick="app.resetAll()">Apagar todos os dados</button></div>
    <p class="muted small" style="text-align:center">GymTrack v4.2</p>`;
}
function setRest(v) { state.settings.restSeconds = parseInt(v); save(); }
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gymtrack-backup-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.plan || !Array.isArray(data.history)) throw new Error('formato inválido');
      state = migrate(data); save(); render();
      alert('Dados importados com sucesso ✓');
    } catch (e) { alert('Ficheiro inválido: ' + e.message); }
  };
  reader.readAsText(file);
  input.value = '';
}
function resetAll() {
  if (!confirm('Apagar TODOS os dados? Esta ação não tem volta.')) return;
  if (!confirm('De certeza? Faz antes um backup em "Exportar".')) return;
  state = defaultState(); save(); render();
}

/* ---------------- modal ---------------- */
function openModal(html) {
  document.getElementById('modal').innerHTML = html;
  document.getElementById('modal-backdrop').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
}

/* ---------------- arranque ---------------- */
document.querySelectorAll('#tabs button').forEach(b =>
  b.addEventListener('click', () => navigate(b.dataset.route)));
document.getElementById('modal-backdrop').addEventListener('click', e => {
  if (e.target.id === 'modal-backdrop') closeModal();
});
window.app = {
  startWorkout, setField, toggleSet, setFeedback, setExNote, setNotes, cancelWorkout, finishWorkout,
  stopRestTimer, calMove, showWorkout, pickExercise, togglePlanEdit, renameDay, removeDay, addDay, saveDay,
  toggleWeekday, editExercise, equipChanged, saveExercise, removeExercise, moveExercise, deleteWorkout, setCardioTarget, setRest,
  logCardio, saveCardio, showCoachNotes, showDay, addWeight, deleteWeight,
  connectSync, disconnectSync, syncNow: syncStart,
  exportData, importData, resetAll, closeModal,
};
render();
if (syncCfg) syncStart();
// ir buscar novidades sempre que a app volta ao ecrã (trocar de app / voltar ao separador)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && syncCfg) syncStart();
});
window.addEventListener('focus', () => { if (syncCfg) syncStart(); });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
