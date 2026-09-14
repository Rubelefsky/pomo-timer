// Thin wrappers around the Capacitor plugins, with browser fallbacks so the
// same code runs on desktop (python launcher / vite dev) and in the apps.
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { StatusBar, Style } from "@capacitor/status-bar";

export const isNative = Capacitor.isNativePlatform();
const ALARM_ID = 1;
const CHANNEL_ID = "timer";
let permissionAsked = false;

export async function initNative() {
  if (!isNative) {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    return;
  }
  try { await StatusBar.setStyle({ style: Style.Dark }); } catch {}
  if (Capacitor.getPlatform() === "android") {
    try { await StatusBar.setBackgroundColor({ color: "#0a0c16" }); } catch {}
    try {
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: "Timer alerts",
        description: "Rings when a pomodoro or break ends",
        sound: "alarm.wav",
        importance: 5,
        visibility: 1,
        vibration: true,
      });
    } catch {}
  }
}

async function ensurePermission() {
  if (permissionAsked) return;
  permissionAsked = true;
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display !== "granted") await LocalNotifications.requestPermissions();
  } catch {}
}

/** Schedule the OS to alert at `at` (ms epoch) even if the app is backgrounded or closed. */
export async function scheduleAlarm(at, title, body) {
  if (!isNative) return;
  await ensurePermission();
  try {
    await cancelAlarm();
    await LocalNotifications.schedule({
      notifications: [{
        id: ALARM_ID,
        title,
        body,
        channelId: CHANNEL_ID,
        sound: "alarm.wav",
        schedule: { at: new Date(at), allowWhileIdle: true },
      }],
    });
  } catch (e) {
    console.warn("Could not schedule alarm", e);
  }
}

export async function cancelAlarm() {
  if (!isNative) return;
  try { await LocalNotifications.cancel({ notifications: [{ id: ALARM_ID }] }); } catch {}
}

/** Desktop-browser notification (native platforms use the scheduled alarm instead). */
export function notifyWeb(title, body) {
  if (isNative) return;
  if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
}

/** Run `cb` whenever the app returns to the foreground. */
export function onResume(cb) {
  if (isNative) App.addListener("appStateChange", ({ isActive }) => { if (isActive) cb(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") cb(); });
}

/** Hand a text file to the share sheet on mobile, or download it in the browser. */
export async function shareOrDownload(filename, text, mime) {
  if (isNative) {
    const { uri } = await Filesystem.writeFile({
      path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8,
    });
    await Share.share({ title: filename, url: uri });
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
