import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";
import "./style.css";
import { supabase, configured } from "./supabase.js";
import * as store from "./store.js";
import {
  isNative, initNative, scheduleAlarm, cancelAlarm, notifyWeb, onResume, shareOrDownload,
} from "./native.js";

const $ = id => document.getElementById(id);
const MODES = { work: "durWork", short: "durShort", long: "durLong" };
const RING_LEN = 2 * Math.PI * 140;
const CAT_COLORS = ["#ff6b5e", "#5aa9ff", "#4ade80", "#f5c76a", "#c084fc", "#f472b6", "#2dd4bf", "#fb923c"];
const TIMER_KEY = "pomo.timer";

let mode = "work";
let running = false;
let remaining = 25 * 60;
let sessionStart = null;   // ISO string while a pomodoro/break is in progress (running or paused)
let plannedMin = 25;
let endTime = null;        // ms epoch when the running timer ends
let tick = null;
let currentTab = "Timer";
let currentUserId = null;

// ---------- categories ----------
let categories = JSON.parse(localStorage.getItem("pomo.categories") || '["Work","Study","Personal"]');
let currentCat = localStorage.getItem("pomo.category") || categories[0];

function catColor(name) {
  let i = categories.indexOf(name);
  if (i < 0) { // stable color for categories no longer in the list
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    i = h;
  }
  return CAT_COLORS[i % CAT_COLORS.length];
}

function saveCats() {
  localStorage.setItem("pomo.categories", JSON.stringify(categories));
  localStorage.setItem("pomo.category", currentCat);
}

function removeCategory(cat) {
  if (categories.length <= 1) return;
  if (!confirm(`Remove category "${cat}"? (Past logs keep it)`)) return;
  categories = categories.filter(c => c !== cat);
  if (currentCat === cat) currentCat = categories[0];
  saveCats();
  renderChips();
}

function renderChips() {
  const box = $("catChips");
  box.innerHTML = "";
  for (const cat of categories) {
    const b = document.createElement("button");
    b.className = "chip" + (cat === currentCat ? " active" : "");
    b.textContent = cat;
    if (cat === currentCat) {
      const c = catColor(cat);
      b.style.background = c + "26";
      b.style.color = c;
      b.style.borderColor = c + "55";
    }
    // Long-press removes on touch screens; double-click removes with a mouse.
    let hold = null, held = false;
    b.addEventListener("pointerdown", () => {
      held = false;
      hold = setTimeout(() => { held = true; removeCategory(cat); }, 650);
    });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, () => clearTimeout(hold));
    b.addEventListener("click", () => {
      if (held) { held = false; return; }
      currentCat = cat;
      localStorage.setItem("pomo.category", cat);
      renderChips();
    });
    b.addEventListener("dblclick", () => removeCategory(cat));
    b.title = "Double-click or long-press to remove";
    box.appendChild(b);
  }
  const add = document.createElement("button");
  add.className = "chip add";
  add.textContent = "+ Add";
  add.addEventListener("click", () => {
    const input = document.createElement("input");
    input.id = "newCatInput";
    input.placeholder = "New category";
    input.maxLength = 24;
    box.replaceChild(input, add);
    input.focus();
    const commit = () => {
      const v = input.value.trim();
      if (v && !categories.includes(v)) {
        categories.push(v);
        currentCat = v;
        saveCats();
      }
      renderChips();
    };
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") renderChips();
    });
    input.addEventListener("blur", commit);
  });
  box.appendChild(add);
}

// ---------- settings persistence ----------
const savedDur = JSON.parse(localStorage.getItem("pomo.durations") || "{}");
for (const [m, inputId] of Object.entries(MODES)) {
  if (savedDur[m]) $(inputId).value = savedDur[m];
  $(inputId).addEventListener("change", () => {
    const d = {};
    for (const [mm, ii] of Object.entries(MODES)) d[mm] = +$(ii).value || 1;
    localStorage.setItem("pomo.durations", JSON.stringify(d));
    if (!running && !sessionStart && mode === m) setMode(mode);
  });
}
$("taskInput").value = localStorage.getItem("pomo.task") || "";
$("taskInput").addEventListener("input", () => localStorage.setItem("pomo.task", $("taskInput").value));

// ---------- timer core ----------
function durFor(m) { return Math.max(1, +$(MODES[m]).value || 1); }

function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function setStatus(msg) { $("status").textContent = msg; }

function render() {
  $("clock").textContent = fmt(remaining);
  const total = plannedMin * 60;
  const frac = sessionStart ? Math.max(0, remaining / total) : 1;
  const ring = $("ringFg");
  ring.style.strokeDasharray = RING_LEN;
  ring.style.strokeDashoffset = RING_LEN * (1 - frac);
  ring.style.stroke = mode === "work" ? "url(#ringGrad)" : "url(#ringGradBlue)";
  document.title = running ? `${fmt(remaining)} — ${mode === "work" ? ($("taskInput").value || "Focus") : "Break"}` : "Pomodoro";
  $("startBtn").textContent = running ? "Pause" : (sessionStart ? "Resume" : "Start");
  $("startBtn").classList.toggle("pause", running);
}

function markModeButtons() {
  document.querySelectorAll(".modes button").forEach(b => {
    b.classList.toggle("active", b.dataset.mode === mode);
    b.classList.toggle("break", b.dataset.mode === mode && mode !== "work");
  });
}

function setMode(m) {
  if (running) return;
  mode = m;
  sessionStart = null;
  endTime = null;
  plannedMin = durFor(m);
  remaining = plannedMin * 60;
  markModeButtons();
  setStatus("");
  persistTimer();
  render();
}
document.querySelectorAll(".modes button").forEach(b =>
  b.addEventListener("click", () => setMode(b.dataset.mode)));

// The in-progress timer is persisted so it survives the app being backgrounded,
// killed, or the page being reloaded. Time is always derived from endTime, never
// from counting ticks, so throttled/frozen JS can't make it drift.
function persistTimer() {
  if (!sessionStart) { localStorage.removeItem(TIMER_KEY); return; }
  localStorage.setItem(TIMER_KEY, JSON.stringify({ mode, plannedMin, sessionStart, running, endTime, remaining }));
}

function restoreTimer() {
  let t = null;
  try { t = JSON.parse(localStorage.getItem(TIMER_KEY)); } catch {}
  if (!t || !t.sessionStart || !MODES[t.mode]) { setMode("work"); return; }
  mode = t.mode;
  plannedMin = t.plannedMin;
  sessionStart = t.sessionStart;
  endTime = t.endTime;
  markModeButtons();
  if (t.running) {
    running = true;
    startTicking();
    syncClock();
  } else {
    running = false;
    remaining = t.remaining;
    render();
  }
}

function startTicking() {
  clearInterval(tick);
  tick = setInterval(syncClock, 1000);
}

function syncClock() {
  if (!running) return;
  remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
  if (remaining <= 0) { finish(); return; }
  render();
}

function alarmText() {
  return mode === "work"
    ? ["Pomodoro complete!", "Nice work. Time for a break."]
    : ["Break's over", "Recharged? Time to get back to it."];
}

function startTimer() {
  if (!sessionStart) {
    sessionStart = new Date().toISOString();
    plannedMin = durFor(mode);
    remaining = plannedMin * 60;
  }
  endTime = Date.now() + remaining * 1000;
  running = true;
  persistTimer();
  startTicking();
  render();
  scheduleAlarm(endTime, ...alarmText());
}

function pauseTimer() {
  running = false;
  clearInterval(tick);
  remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
  persistTimer();
  cancelAlarm();
  render();
}

$("startBtn").addEventListener("click", () => {
  if (running) { pauseTimer(); return; }
  if (mode === "work" && !$("taskInput").value.trim()) {
    setStatus("Tip: set a task so it shows on your dashboard.");
  }
  startTimer();
});

$("resetBtn").addEventListener("click", () => {
  if (sessionStart) {
    if (running) remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    const elapsedMin = plannedMin - remaining / 60;
    if (elapsedMin >= 1) logSession({ completed: false, actualMin: elapsedMin, endedAt: new Date().toISOString() });
  }
  running = false;
  clearInterval(tick);
  cancelAlarm();
  setMode(mode);
});

function finish() {
  if (!sessionStart) return;                 // already handled (e.g. resume + tick racing)
  running = false;
  clearInterval(tick);
  remaining = 0;
  render();
  const wasWork = mode === "work";
  const task = $("taskInput").value.trim();
  logSession({ completed: true, actualMin: plannedMin, endedAt: new Date(endTime).toISOString() });
  sessionStart = null;
  endTime = null;
  persistTimer();
  $("startBtn").textContent = "Start";       // ring stays empty, but the next press starts fresh
  if (!isNative) {                           // on phones the scheduled notification does this
    beep();
    notifyWeb("PomoTimer", wasWork ? "Pomodoro complete! Take a break." : "Break over — back to it!");
  }
  showModal(wasWork, task);
}

// ---------- completion modal ----------
function showModal(wasWork, task) {
  $("modalIcon").classList.toggle("break", wasWork);
  $("modalTitle").textContent = wasWork ? "Pomodoro complete!" : "Break's over";
  $("modalMsg").textContent = wasWork
    ? (task ? `Nice work on “${task}”. Time for a break.` : "Nice work. Time for a break.")
    : "Recharged? Time to get back to it.";
  const primary = $("modalPrimary");
  primary.textContent = wasWork ? "Start break" : "Start focus";
  primary.classList.toggle("break", wasWork);
  primary.dataset.next = wasWork ? "short" : "work";
  $("modalOverlay").classList.add("show");
}
function hideModal() { $("modalOverlay").classList.remove("show"); }
$("modalPrimary").addEventListener("click", () => {
  const next = $("modalPrimary").dataset.next;
  hideModal();
  setMode(next);
  startTimer();
});
$("modalDismiss").addEventListener("click", () => {
  const next = $("modalPrimary").dataset.next;
  hideModal();
  setMode(next);
});

// ---------- logging ----------
async function logSession({ completed, actualMin, endedAt }) {
  const entry = {
    task: mode === "work" ? ($("taskInput").value.trim() || "(unlabeled)") : "",
    category: mode === "work" ? currentCat : "",
    type: mode === "work" ? "work" : "break",
    planned_min: plannedMin,
    actual_min: actualMin,
    started_at: sessionStart,
    ended_at: endedAt,
    completed,
  };
  const synced = await store.add(entry);
  if (!synced) setStatus("Saved on this device — will sync when back online.");
  refreshDash();
}

// ---------- sound ----------
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
    });
  } catch {}
}

// ---------- dashboard ----------
function sameDay(a, b) { return a.toDateString() === b.toDateString(); }
function weekStart(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function fmtMin(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
function fmtWhen(iso) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function catPill(name) {
  if (!name) return "—";
  const c = catColor(name);
  return `<span class="cat-pill" style="background:${c}26;color:${c}">${esc(name)}</span>`;
}
function setDashMsg(msg, isError = false) {
  const el = $("dashMsg");
  el.textContent = msg;
  el.classList.toggle("error", isError);
  el.classList.toggle("hidden", !msg);
}

function refreshDash() {
  const sessions = store.sessions;
  const now = new Date(), ws = weekStart(now);
  const work = sessions.filter(s => s.type === "work");
  const todayDone = work.filter(s => s.completed && sameDay(new Date(s.ended_at), now));
  const todayMin = work.filter(s => sameDay(new Date(s.ended_at), now))
                       .reduce((a, s) => a + (s.actual_min || 0), 0);
  const weekWork = work.filter(s => new Date(s.ended_at) >= ws);
  const weekMin = weekWork.reduce((a, s) => a + (s.actual_min || 0), 0);

  $("statToday").textContent = todayDone.length;
  $("statTodayMin").textContent = fmtMin(todayMin);
  $("statWeekMin").textContent = fmtMin(weekMin);
  $("statTotal").textContent = sessions.length;

  // category bars (this week)
  const byCat = {};
  for (const s of weekWork) {
    const c = s.category || "(none)";
    byCat[c] = (byCat[c] || 0) + (s.actual_min || 0);
  }
  const maxCat = Math.max(1, ...Object.values(byCat));
  const catRows = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([c, min]) => {
      const col = c === "(none)" ? "#565b72" : catColor(c);
      return `<div class="cat-bar-row">
        <div class="name" style="color:${col}">${esc(c)}</div>
        <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(min / maxCat * 100).toFixed(1)}%;background:${col}"></div></div>
        <div class="mins">${fmtMin(min)}</div>
      </div>`;
    });
  $("catBars").innerHTML = catRows.join("");
  $("catEmpty").classList.toggle("hidden", catRows.length > 0);
  $("catBars").classList.toggle("hidden", catRows.length === 0);

  // by-task table
  const byTask = {};
  for (const s of work) {
    const t = s.task || "(unlabeled)";
    byTask[t] = byTask[t] || { count: 0, min: 0, last: s.ended_at, cat: s.category || "" };
    if (s.completed) byTask[t].count++;
    byTask[t].min += s.actual_min || 0;
    if (s.ended_at > byTask[t].last) { byTask[t].last = s.ended_at; byTask[t].cat = s.category || byTask[t].cat; }
  }
  const taskRows = Object.entries(byTask)
    .sort((a, b) => b[1].last.localeCompare(a[1].last))
    .map(([t, v]) =>
      `<tr><td>${esc(t)}</td><td>${catPill(v.cat)}</td><td>${v.count}</td><td>${fmtMin(v.min)}</td><td>${fmtWhen(v.last)}</td></tr>`);
  $("taskTable").querySelector("tbody").innerHTML = taskRows.join("");
  $("taskEmpty").classList.toggle("hidden", taskRows.length > 0);
  $("taskWrap").classList.toggle("hidden", taskRows.length === 0);

  // history (latest 50)
  const histRows = sessions.slice().reverse().slice(0, 50).map(s =>
    `<tr>
      <td>${fmtWhen(s.started_at)}</td>
      <td>${esc(s.task) || "—"}</td>
      <td>${catPill(s.category)}</td>
      <td><span class="tag ${s.type}">${s.type}</span></td>
      <td>${fmtMin(s.actual_min || 0)}</td>
      <td class="${s.completed ? "done" : "abandoned"}">${s.completed ? "completed" : "stopped early"}</td>
      <td><button class="del-btn" data-id="${s.id}" title="Delete this session">✕</button></td>
    </tr>`);
  $("histTable").querySelector("tbody").innerHTML = histRows.join("");
  $("histEmpty").classList.toggle("hidden", histRows.length > 0);
  $("histWrap").classList.toggle("hidden", histRows.length === 0);

  // task autocomplete
  $("taskList").innerHTML = Object.keys(byTask)
    .filter(t => t !== "(unlabeled)")
    .map(t => `<option value="${esc(t)}">`).join("");

  const n = store.pendingCount();
  $("syncNote").textContent = n ? `${n} change${n === 1 ? "" : "s"} waiting to sync` : "";
  $("syncNote").classList.toggle("hidden", n === 0);
}

// two-step inline confirm, then delete
$("histTable").addEventListener("click", async e => {
  const btn = e.target.closest(".del-btn");
  if (!btn) return;
  if (!btn.classList.contains("confirm")) {
    btn.classList.add("confirm");
    btn.textContent = "Delete?";
    setTimeout(() => { btn.classList.remove("confirm"); btn.textContent = "✕"; }, 2500);
    return;
  }
  await store.remove(btn.dataset.id);
  refreshDash();
});

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- export / import / sign out ----------
$("exportCsvBtn").addEventListener("click", () =>
  shareOrDownload("pomodoro-sessions.csv", store.toCsv(), "text/csv").catch(e => setDashMsg(e.message, true)));
$("exportJsonBtn").addEventListener("click", () =>
  shareOrDownload("pomodoro-sessions.json", store.toJson(), "application/json").catch(e => setDashMsg(e.message, true)));
$("importInput").addEventListener("change", async e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  setDashMsg("Importing…");
  try {
    const r = await store.importJson(await file.text());
    setDashMsg(`Imported ${r.imported} session${r.imported === 1 ? "" : "s"}; skipped ${r.skipped} already present.`);
  } catch (err) {
    setDashMsg("Import failed: " + err.message, true);
  }
  refreshDash();
});
$("signOutBtn").addEventListener("click", async () => {
  const n = store.pendingCount();
  if (n && !confirm(`${n} change${n === 1 ? " hasn't" : "s haven't"} synced yet and will be lost. Sign out anyway?`)) return;
  await supabase.auth.signOut();
  store.clearLocal();
  refreshDash();
});

// ---------- tabs ----------
$("tabTimer").addEventListener("click", () => switchTab("Timer"));
$("tabDash").addEventListener("click", () => {
  refreshDash();
  switchTab("Dash");
  pullFromCloud();
});
function switchTab(name) {
  currentTab = name;
  $("viewTimer").classList.toggle("hidden", name !== "Timer");
  $("viewDash").classList.toggle("hidden", name !== "Dash");
  $("tabTimer").classList.toggle("active", name === "Timer");
  $("tabDash").classList.toggle("active", name === "Dash");
}

function pullFromCloud() {
  if (!currentUserId) return;
  store.refresh()
    .then(() => { setDashMsg(""); refreshDash(); })
    .catch(err => { setDashMsg("Showing cached data — " + err.message, true); refreshDash(); });
}

// ---------- auth ----------
function showSignedOut(signedOut) {
  document.body.classList.toggle("signed-out", signedOut);
  $("viewAuth").classList.toggle("hidden", !signedOut);
  if (signedOut) {
    $("viewTimer").classList.add("hidden");
    $("viewDash").classList.add("hidden");
  } else {
    switchTab(currentTab);
  }
}

function applySession(session) {
  const uid = session?.user?.id || null;
  showSignedOut(!uid);
  if (!uid) { currentUserId = null; return; }
  $("userEmail").textContent = session.user.email || "";
  if (uid !== currentUserId) {
    currentUserId = uid;
    setTimeout(pullFromCloud, 0);       // never await Supabase inside its own auth callback
  }
}

function setAuthMsg(msg) { $("authMsg").textContent = msg; }

async function authenticate(create) {
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  if (!email || !password) { setAuthMsg("Enter your email and a password."); return; }
  $("authForm").classList.add("busy");
  setAuthMsg("");
  const { data, error } = create
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });
  $("authForm").classList.remove("busy");
  if (error) { setAuthMsg(error.message); return; }
  if (create && !data.session) setAuthMsg("Account created. Check your email for a confirmation link, then sign in.");
}
$("authForm").addEventListener("submit", e => { e.preventDefault(); authenticate(false); });
$("signUpBtn").addEventListener("click", () => authenticate(true));

async function initAuth() {
  if (!configured) {
    document.body.classList.add("signed-out");
    $("viewSetup").classList.remove("hidden");
    return;
  }
  const { data } = await supabase.auth.getSession();
  applySession(data.session);
  supabase.auth.onAuthStateChange((_event, session) => applySession(session));
}

// ---------- boot ----------
store.init();
renderChips();
restoreTimer();
refreshDash();
initNative();
initAuth();
onResume(() => {
  if (running) syncClock();
  if (currentTab === "Dash") pullFromCloud();
  else if (currentUserId) store.flush().then(refreshDash);
});
window.addEventListener("online", () => { if (currentUserId) store.flush().then(refreshDash); });
