import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const memory = new Map<string, string>();
let warmed: Promise<void> | null = null;
let writing = Promise.resolve();

function nativeFile() {
  if (!requireOptionalNativeModule('ExponentFileSystem') && !requireOptionalNativeModule('ExpoFileSystem')) return null;
  const fs = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
  if (!fs.documentDirectory) return null;
  return { fs, file: `${fs.documentDirectory}charodey-kv.json` };
}

function rememberRaw(key: string, raw: string) {
  if (!memory.has(key)) memory.set(key, raw);
}

async function loadNative() {
  const native = nativeFile();
  if (!native) return;
  try {
    const info = await native.fs.getInfoAsync(native.file);
    if (!info.exists) return;
    const parsed = JSON.parse(await native.fs.readAsStringAsync(native.file)) as Record<string, string>;
    for (const [key, value] of Object.entries(parsed)) rememberRaw(key, value);
  } catch {
    // A broken cache file should not block the screen.
  }
}

function loadWeb() {
  const storage = globalThis.localStorage;
  if (!storage) return;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith('charodey.')) continue;
    const value = storage.getItem(key);
    if (value != null) rememberRaw(key, value);
  }
}

export function warmStore() {
  if (!warmed) {
    warmed = Platform.OS === 'web' ? Promise.resolve().then(loadWeb) : loadNative();
  }
  return warmed;
}

export function peekJson<T>(key: string): T | null {
  let raw = memory.get(key);
  if (raw == null && Platform.OS === 'web') {
    raw = globalThis.localStorage?.getItem(key) ?? undefined;
    if (raw != null) memory.set(key, raw);
  }
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function readJson<T>(key: string): Promise<T | null> {
  await warmStore();
  return peekJson<T>(key);
}

function persist() {
  const snapshot = Object.fromEntries(memory);
  writing = writing
    .then(async () => {
      if (Platform.OS === 'web') {
        for (const [key, value] of Object.entries(snapshot)) {
          if (key.startsWith('charodey.')) globalThis.localStorage?.setItem(key, value);
        }
        return;
      }
      const native = nativeFile();
      if (!native) return;
      await native.fs.writeAsStringAsync(native.file, JSON.stringify(snapshot));
    })
    .catch(() => undefined);
  return writing;
}

export async function writeJson(key: string, value: unknown) {
  await warmStore();
  memory.set(key, JSON.stringify(value));
  void persist();
}
