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
    version: 2,
    settings: { unit: 'kg', restSeconds: 90 },
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
      hist('2026-05-21', 'Corrida — 25 min', [], 'Semana 21 · ~3 km, blocos 6→10 km/h'),
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
let state = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error('load falhou', e); }
  return defaultState();
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

/* ---------------- router ---------------- */
let route = 'today';
let calOffset = 0;
let progressEx = null;
let chart = null;

function navigate(r) { route = r; render(); }
function render() {
  document.querySelectorAll('#tabs button').forEach(b =>
    b.classList.toggle('active', b.dataset.route === route));
  const v = document.getElementById('view');
  if (state.activeSession && route === 'today') v.innerHTML = viewSession();
  else v.innerHTML = ({ today: viewToday, calendar: viewCalendar, progress: viewProgress, plan: viewPlan, settings: viewSettings }[route])();
  if (route === 'progress') drawChart();
}

/* ---------------- vista: HOJE ---------------- */
function viewToday() {
  const dow = new Date().getDay();
  const suggested = state.plan.days.find(d => d.weekdays.includes(dow));
  const doneToday = state.history.some(h => h.date === todayKey());
  let html = `<h1>Olá, João! 💪</h1><p class="sub">${new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>`;

  if (doneToday) html += `<div class="card highlight"><h3>✅ Treino de hoje concluído</h3><p class="muted">Bom trabalho. Descansa e hidrata-te!</p></div>`;
  else if (suggested) html += dayCard(suggested, true);
  else html += `<div class="card"><h3>Dia de descanso 😴</h3><p class="muted">Não tens treino agendado para hoje, mas podes começar qualquer um abaixo.</p></div>`;

  const others = state.plan.days.filter(d => d !== suggested);
  if (others.length) {
    html += `<h2>Outros treinos</h2>`;
    html += others.map(d => dayCard(d, false)).join('');
  }

  const last = state.history[state.history.length - 1];
  if (last) {
    html += `<h2>Último treino</h2>
      <div class="card"><div class="row"><div><h3>${esc(last.name)}</h3>
      <p class="muted">${fmtDate(last.date)} · ${last.exercises.length} exercícios${volume(last) ? ` · ${volume(last).toLocaleString('pt-PT')} kg de volume` : ''}</p></div>
      <button class="btn sm" onclick="app.showWorkout('${last.id}')">Ver</button></div></div>`;
  }
  return html;
}
function dayCard(day, suggested) {
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
function startWorkout(dayId) {
  const day = state.plan.days.find(d => d.id === dayId);
  if (!day) return;
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
    cells += `<div class="cal-day ${trained ? 'trained' : ''} ${isToday ? 'today' : ''}"
      ${trained ? `onclick="app.showWorkout('${trained[0].id}')"` : ''}>
      ${d}${trained ? '<span class="dot">●</span>' : ''}</div>`;
  }
  const inMonth = state.history.filter(h => h.date.startsWith(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)).length;

  return `<h1>Calendário</h1><p class="sub">Os teus dias de treino</p>
    <div class="cal-head">
      <button class="btn sm" onclick="app.calMove(-1)">‹</button>
      <b style="text-transform:capitalize">${monthName}</b>
      <button class="btn sm" onclick="app.calMove(1)">›</button>
    </div>
    <div class="cal-grid">${cells}</div>
    <div class="stats" style="margin-top:16px">
      <div class="stat"><div class="v">${inMonth}</div><div class="l">treinos este mês</div></div>
      <div class="stat"><div class="v">${streak()}</div><div class="l">semanas seguidas a treinar</div></div>
    </div>`;
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
function showWorkout(id) {
  const h = state.history.find(x => x.id === id);
  if (!h) return;
  const vol = volume(h);
  openModal(`<h3>${esc(h.name)}</h3><p class="muted">${fmtDate(h.date)}${vol ? ` · volume ${vol.toLocaleString('pt-PT')} kg` : ''}</p>
    ${h.exercises.map(sx => `<div class="summary-item"><b>${esc(sx.name)}</b> ${sx.feedback ? FEEDBACKS.find(f => f.id === sx.feedback)?.label.split(' ')[0] : ''}<br>
      <span class="muted">${sx.sets.filter(s => s.done).map(s => setDisplay(sx, s)).join(' · ') || 'sem detalhe registado'}</span>
      ${sx.note ? `<br><span class="muted small">📝 ${esc(sx.note)}</span>` : ''}</div>`).join('')}
    ${h.notes ? `<p class="muted">📝 ${esc(h.notes)}</p>` : ''}
    <button class="btn block" style="margin-top:14px" onclick="app.closeModal()">Fechar</button>`);
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
function allExerciseNames() {
  const names = new Set();
  state.plan.days.forEach(d => d.exercises.forEach(e => names.add(e.name)));
  state.history.forEach(h => h.exercises.forEach(e => names.add(e.name)));
  return [...names];
}
function viewProgress() {
  const names = allExerciseNames();
  if (!progressEx || !names.includes(progressEx)) progressEx = names[0] || null;
  const last30 = state.history.filter(h => (Date.now() - new Date(h.date + 'T12:00:00')) / 86400000 <= 30).length;
  const weekVol = state.history.filter(h => (Date.now() - new Date(h.date + 'T12:00:00')) / 86400000 <= 7)
    .reduce((t, h) => t + volume(h), 0);
  const unit = EQUIPS[exerciseEquip(progressEx)]?.unit || 'kg';
  return `<h1>Progresso</h1><p class="sub">A tua evolução ao longo do tempo</p>
    <div class="stats">
      <div class="stat"><div class="v">${state.history.length}</div><div class="l">treinos no total</div></div>
      <div class="stat"><div class="v">${last30}</div><div class="l">últimos 30 dias</div></div>
      <div class="stat"><div class="v">${weekVol.toLocaleString('pt-PT')}</div><div class="l">kg volume (halteres) / 7 dias</div></div>
      <div class="stat"><div class="v">${streak()}</div><div class="l">semanas seguidas</div></div>
    </div>
    <h2>Evolução por exercício</h2>
    <select onchange="app.pickExercise(this.value)">${names.map(n => `<option ${n === progressEx ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    <div class="chart-wrap"><canvas id="chart" height="220"></canvas></div>
    <p class="muted small" style="margin-top:8px">Linha verde: carga máxima por sessão (${unit}) · Linha azul: total de reps × carga da sessão</p>`;
}
function pickExercise(n) { progressEx = n; render(); }
function drawChart() {
  const cv = document.getElementById('chart');
  if (!cv || !window.Chart) return;
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
      labels: points.map(p => fmtDate(p.date)),
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
  return `<h1>Plano de treino</h1><p class="sub">Full Body 3×/semana · Mesociclo 1 (readaptação) · edita à vontade</p>
    ${state.plan.days.map(d => `
      <div class="card">
        <div class="row"><h3>${esc(d.name)}</h3>
          <div><button class="btn sm" onclick="app.renameDay('${d.id}')">✏️</button>
          <button class="btn sm danger" onclick="app.removeDay('${d.id}')">🗑️</button></div></div>
        <div class="chips">${WEEKDAYS.map((w, i) =>
          `<span class="chip ${d.weekdays.includes(i) ? 'on' : ''}" onclick="app.toggleWeekday('${d.id}',${i})">${w}</span>`).join('')}</div>
        ${d.exercises.map(e => `
          <div class="plan-ex">
            <div class="info"><b>${esc(e.name)}</b> <span class="badge">${EQUIPS[e.equip]?.label || e.equip}</span>
              <div>${repsLabel(e)} · ${weightsLabel(e)}</div></div>
            <div><button class="btn sm" onclick="app.editExercise('${d.id}','${e.id}')">✏️</button>
            <button class="btn sm danger" onclick="app.removeExercise('${d.id}','${e.id}')">✕</button></div>
          </div>`).join('')}
        <button class="btn sm block ghost" style="margin-top:10px" onclick="app.editExercise('${d.id}',null)">+ Adicionar exercício</button>
      </div>`).join('')}
    <button class="btn block" onclick="app.addDay()">+ Adicionar treino</button>`;
}
function addDay() {
  const name = prompt('Nome do treino (ex: Dia D — Ombros):');
  if (!name) return;
  state.plan.days.push({ id: uid(), name, weekdays: [], exercises: [] });
  save(); render();
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

/* ---------------- vista: DEFINIÇÕES ---------------- */
function viewSettings() {
  return `<h1>Definições</h1><p class="sub">Dados e preferências</p>
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
      <button class="btn danger" onclick="app.resetAll()">Apagar todos os dados</button></div>`;
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
      state = data; save(); render();
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
  stopRestTimer, calMove, showWorkout, pickExercise, renameDay, removeDay, addDay,
  toggleWeekday, editExercise, equipChanged, saveExercise, removeExercise, setRest,
  exportData, importData, resetAll, closeModal,
};
render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
