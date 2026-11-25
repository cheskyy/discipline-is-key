import { useEffect, useRef, useState } from 'react';

export const CATEGORIES = [
  { id: 'kuliah', label: 'Kuliah' },
  { id: 'organisasi', label: 'Organisasi' },
  { id: 'pribadi', label: 'Kebutuhan pribadi' },
  { id: 'pengembangan', label: 'Pengembangan diri' },
  { id: 'kesehatan', label: 'Istirahat dan kesehatan' },
];

const EXAMPLES = [
  { id: 'contoh-1', title: 'Baca ulang catatan kuliah', category: 'kuliah', done: false },
  { id: 'contoh-2', title: 'Cek kabar dari tim organisasi', category: 'organisasi', done: false },
  { id: 'contoh-3', title: 'Rapikan meja belajar', category: 'pribadi', done: true },
  { id: 'contoh-4', title: 'Latihan bahasa Inggris 15 menit', category: 'pengembangan', done: false },
  { id: 'contoh-5', title: 'Minum segelas air setelah bangun', category: 'kesehatan', done: true },
];

const QUOTES = [
  'Satu langkah kecil hari ini bisa membentuk kebiasaan baik esok hari.',
  'Mulai dari satu hal yang bisa kamu selesaikan hari ini.',
  'Kemajuan tumbuh dari hal kecil yang kamu ulangi setiap hari.',
  'Beri dirimu waktu untuk belajar, lalu coba lagi besok.',
  'Rayakan satu kegiatan yang berhasil kamu selesaikan hari ini.',
  'Sisakan waktu untuk istirahat agar esok bisa mulai lagi.',
  'Sedikit lebih teratur setiap hari sudah cukup untuk membuat kemajuan.',
];

const STORAGE_KEY = 'discipline-is-key:agenda:v1';
const CATEGORY_IDS = new Set(CATEGORIES.map(({ id }) => id));
const dateFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' });

export function dayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function dayLabel(key) {
  const [year, month, day] = key.split('-').map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

export function dailyQuote(key) {
  const dateIndex = Math.floor(Date.parse(key) / 86_400_000);
  return QUOTES[((dateIndex % QUOTES.length) + QUOTES.length) % QUOTES.length];
}

export function greeting(date) {
  const hour = date.getHours();
  if (hour >= 4 && hour < 11) return 'Selamat pagi';
  if (hour >= 11 && hour < 15) return 'Selamat siang';
  if (hour >= 15 && hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer;
    function syncClock() {
      const current = new Date();
      setNow(current);
      window.clearTimeout(timer);
      timer = window.setTimeout(syncClock, 60_000 - (current.getTime() % 60_000));
    }

    syncClock();
    window.addEventListener('focus', syncClock);
    document.addEventListener('visibilitychange', syncClock);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', syncClock);
      document.removeEventListener('visibilitychange', syncClock);
    };
  }, []);

  return now;
}

function readStoredAgenda() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return null;
  const agenda = JSON.parse(stored);
  if (agenda === null || typeof agenda !== 'object' || Array.isArray(agenda)) {
    throw new Error('Format agenda tidak dikenali.');
  }
  for (const [key, tasks] of Object.entries(agenda)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(tasks) || !tasks.every(isStoredTask)) {
      throw new Error('Format agenda tidak dikenali.');
    }
  }
  return agenda;
}

function isStoredTask(task) {
  return task !== null && typeof task === 'object'
    && typeof task.id === 'string' && typeof task.title === 'string'
    && typeof task.done === 'boolean' && CATEGORY_IDS.has(task.category);
}

function firstAgenda() {
  const examples = { [dayKey(new Date())]: EXAMPLES };
  try {
    return { days: readStoredAgenda() ?? examples, storageError: false };
  } catch {
    return { days: examples, storageError: true };
  }
}

export function useAgenda() {
  const [state, setState] = useState(firstAgenda);
  const current = useRef(state);

  function updateState(next) {
    current.current = next;
    setState(next);
  }

  useEffect(() => {
    try {
      const saved = readStoredAgenda();
      if (saved === null) localStorage.setItem(STORAGE_KEY, JSON.stringify(current.current.days));
    } catch {
      updateState({ ...current.current, storageError: true });
    }

    function syncStorage(event) {
      if (event.key !== STORAGE_KEY || current.current.storageError) return;
      try {
        updateState({ days: readStoredAgenda() ?? {}, storageError: false });
      } catch {
        updateState({ ...current.current, storageError: true });
      }
    }

    window.addEventListener('storage', syncStorage);
    return () => window.removeEventListener('storage', syncStorage);
  }, []);

  function changeDay(key, changeTasks) {
    const previous = current.current;
    let pending = previous.days;
    try {
      const stored = readStoredAgenda();
      if (!previous.storageError) pending = stored ?? previous.days;
      const days = { ...pending, [key]: changeTasks(pending[key] ?? []) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
      updateState({ days, storageError: false });
    } catch {
      const days = { ...pending, [key]: changeTasks(pending[key] ?? []) };
      updateState({ days, storageError: true });
    }
  }

  return { ...state, changeDay };
}
