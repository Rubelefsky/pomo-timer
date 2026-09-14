// Session store: Supabase is the source of truth, with a local cache so the
// dashboard renders instantly and a write queue so sessions logged offline
// (or while the token is stale) sync the next time we can reach the server.
import { supabase } from "./supabase.js";

const CACHE_KEY = "pomo.sessions";
const PENDING_KEY = "pomo.pending";
const FIELDS = ["id", "started_at", "ended_at", "task", "category", "type",
                "planned_min", "actual_min", "completed"];

/** Sessions sorted by started_at ascending. Live binding — read via the module namespace. */
export let sessions = [];
let pending = [];
let flushing = null;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveCache() { localStorage.setItem(CACHE_KEY, JSON.stringify(sessions)); }
function savePending() { localStorage.setItem(PENDING_KEY, JSON.stringify(pending)); }
function sortSessions() { sessions.sort((a, b) => a.started_at.localeCompare(b.started_at)); }

export function init() {
  sessions = readJson(CACHE_KEY, []);
  pending = readJson(PENDING_KEY, []);
}

export function pendingCount() { return pending.length; }

export function clearLocal() {
  sessions = [];
  pending = [];
  saveCache();
  savePending();
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

function iso(v) {
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}

/** Coerce a row from Supabase, a legacy sessions.json, or a new entry into the app's shape. */
export function normalize(raw) {
  const started = iso(raw.started_at);
  if (!started) return null;
  const isBreak = raw.type === "break" || raw.mode === "short" || raw.mode === "long";
  return {
    id: raw.id || uuid(),
    started_at: started,
    ended_at: iso(raw.ended_at) || started,
    task: String(raw.task ?? ""),
    category: String(raw.category ?? ""),
    type: isBreak ? "break" : "work",
    planned_min: Number(raw.planned_min) || 0,
    actual_min: Math.round((Number(raw.actual_min) || 0) * 10) / 10,
    completed: Boolean(raw.completed),
  };
}

async function signedIn() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

// Errors worth retrying later: no network, or an expired token that will be refreshed.
function isTransient(error) {
  return !error.code || error.code === "PGRST301" || /fetch|network|timeout/i.test(error.message || "");
}

/** Push queued writes to Supabase. Resolves true when the queue is empty afterwards. */
export async function flush() {
  while (flushing) await flushing;     // let the in-flight run finish, then run again for anything queued since
  flushing = doFlush().finally(() => { flushing = null; });
  return flushing;
}

async function doFlush() {
  if (!supabase || !pending.length || !(await signedIn())) return pending.length === 0;
  while (pending.length) {
    const p = pending[0];
    const { error } = p.op === "insert"
      ? await supabase.from("sessions").insert(p.row)
      : await supabase.from("sessions").delete().eq("id", p.id);
    if (error && error.code !== "23505") {          // 23505 = row already there: treat as done
      if (isTransient(error)) return false;
      console.warn("Dropping change that the server rejected", p, error);
    }
    pending = pending.filter(x => x !== p);
    savePending();
  }
  return true;
}

/** Sync queued writes, then reload everything from Supabase (merging anything still queued). */
export async function refresh() {
  if (!supabase) return sessions;
  await flush();
  const { data, error } = await supabase.from("sessions").select(FIELDS.join(",")).order("started_at");
  if (error) throw error;
  const list = data.map(normalize).filter(Boolean);
  const have = new Set(list.map(s => s.id));
  const deletes = new Set(pending.filter(p => p.op === "delete").map(p => p.id));
  for (const p of pending) if (p.op === "insert" && !have.has(p.row.id)) list.push(p.row);
  sessions = list.filter(s => !deletes.has(s.id));
  sortSessions();
  saveCache();
  return sessions;
}

export async function add(entry) {
  const row = normalize(entry);
  sessions.push(row);
  sortSessions();
  saveCache();
  pending.push({ op: "insert", row });
  savePending();
  return flush();
}

export async function remove(id) {
  await flush();                                     // let any in-flight insert settle first
  sessions = sessions.filter(s => s.id !== id);
  saveCache();
  const queued = pending.some(p => p.op === "insert" && p.row.id === id);
  pending = pending.filter(p => !(p.op === "insert" && p.row.id === id));
  if (!queued) pending.push({ op: "delete", id });
  savePending();
  return flush();
}

/** Import a JSON array of sessions (the old sessions.json or an Export JSON file). Requires network. */
export async function importJson(text) {
  const raw = JSON.parse(text);
  if (!Array.isArray(raw)) throw new Error("Expected a JSON array of sessions");
  const seen = new Set(sessions.map(s => s.started_at));
  const rows = [];
  for (const r of raw) {
    const row = normalize(r);
    if (row && !seen.has(row.started_at)) { seen.add(row.started_at); rows.push(row); }
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from("sessions").insert(rows.slice(i, i + 200));
    if (error) throw error;
  }
  await refresh();
  return { imported: rows.length, skipped: raw.length - rows.length };
}

export function toCsv() {
  const fields = FIELDS.filter(f => f !== "id");
  const cell = v => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [fields.join(","), ...sessions.map(s => fields.map(f => cell(s[f])).join(","))];
  return lines.join("\r\n") + "\r\n";
}

export function toJson() {
  return JSON.stringify(sessions, null, 2);
}
