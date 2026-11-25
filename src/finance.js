import { useEffect, useState } from 'react';
import { dayKey } from './agenda.js';

function options(entries) {
  return entries.map(([id, label]) => ({ id, label }));
}

export const INCOME_CATEGORIES = options([
  ['weekly-money', 'Uang mingguan'],
  ['extra-money', 'Uang tambahan'],
  ['family', 'Pemberian keluarga'],
  ['other-income', 'Penghasilan lainnya'],
]);

export const EXPENSE_CATEGORIES = options([
  ['food', 'Makan dan minum'],
  ['transport', 'Bensin dan transportasi'],
  ['internet', 'Kuota internet'],
  ['electricity', 'Token listrik'],
  ['housing', 'Kebutuhan kos'],
  ['personal', 'Skincare dan kebutuhan pribadi'],
  ['organization', 'Organisasi'],
  ['entertainment', 'Hiburan dan jajan'],
  ['other-expense', 'Lainnya'],
]);

export const RESERVES = options([
  ['savings', 'Tabungan pribadi'],
  ['emergency', 'Dana darurat'],
]);

export const TRANSACTION_KINDS = options([
  ['income', 'Pemasukan'],
  ['expense', 'Pengeluaran'],
  ['deposit', 'Setoran simpanan'],
  ['withdrawal', 'Penarikan simpanan'],
]);

const KIND_CATEGORIES = {
  income: INCOME_CATEGORIES,
  expense: EXPENSE_CATEGORIES,
  deposit: RESERVES,
  withdrawal: RESERVES,
};

const STORAGE_KEY = 'discipline-is-key:finance:v1';
const DEFAULT_DATA = {
  transactions: [],
  budgets: {
    weekly: { total: 250_000, categories: { transport: 45_000 }, allocations: {} },
    monthly: { total: null, categories: { electricity: 100_000 }, allocations: {} },
  },
  goals: { savings: null, emergency: null },
};

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
});
export const rupiah = (amount) => currencyFormatter.format(amount);
export const groupForKind = (kind) => Object.hasOwn(KIND_CATEGORIES, kind) ? KIND_CATEGORIES[kind] : [];

function emptyBalances() {
  return { income: 0, expenses: 0, wallet: 0, savings: 0, emergency: 0 };
}

function applyEntry(balances, { kind, category, amount }) {
  if (kind === 'income') {
    balances.income += amount;
    balances.wallet += amount;
  } else if (kind === 'expense') {
    balances.expenses += amount;
    balances.wallet -= amount;
  } else if (kind === 'deposit') {
    balances.wallet -= amount;
    balances[category] += amount;
  } else {
    balances.wallet += amount;
    balances[category] -= amount;
  }
}

export function financeBalances(transactions) {
  const balances = emptyBalances();
  for (const entry of transactions) applyEntry(balances, entry);
  return balances;
}

function localDate(key) {
  return new Date(key + 'T12:00:00');
}

function isDateKey(key) {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key)
    && dayKey(localDate(key)) === key;
}

export function financeReport(transactions, today, period) {
  const start = localDate(today);
  if (period === 'weekly') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  else start.setDate(1);
  const from = dayKey(start);
  const to = today;
  const entries = transactions.filter(({ date }) => from <= date && date <= to);

  const amounts = new Map();
  for (const { kind, category, amount } of entries) {
    if (kind === 'expense') amounts.set(category, (amounts.get(category) ?? 0) + amount);
  }
  const byCategory = EXPENSE_CATEGORIES
    .filter(({ id }) => amounts.has(id))
    .map((category) => ({ ...category, amount: amounts.get(category.id) }))
    .sort((left, right) => right.amount - left.amount);
  return { ...financeBalances(entries), from, to, byCategory, topCategory: byCategory[0] ?? null };
}

export function budgetTone(spent, limit) {
  if (!limit) return { level: 'normal', label: '', percent: 0 };
  const percent = Math.max(0, spent / limit * 100);
  if (spent > limit) return { level: 'over', label: 'Melebihi batas', percent };
  if (spent === limit) return { level: 'hit', label: 'Batas tercapai', percent };
  if (percent >= 80) return { level: 'near', label: 'Mendekati batas', percent };
  return { level: 'normal', label: '', percent };
}

class FinanceValidationError extends Error {}

function wholeRupiah(value) {
  const input = String(value ?? '').trim();
  if (!input) return 0;
  const digits = /^\d{1,3}(\.\d{3})+$/.test(input) ? input.replaceAll('.', '') : input;
  const amount = Number(digits);
  if (!/^\d+$/.test(digits) || !Number.isSafeInteger(amount)) {
    throw new FinanceValidationError('Isi nominal dalam Rupiah utuh, misalnya 25000.');
  }
  return amount;
}

function cleanedLimits(fields, categories) {
  return Object.fromEntries(categories.map(({ id }) => [id, wholeRupiah(fields?.[id]) || null]));
}

function cleanedBudget(budget) {
  return {
    total: wholeRupiah(budget.total) || null,
    categories: cleanedLimits(budget.categories, EXPENSE_CATEGORIES),
    allocations: cleanedLimits(budget.allocations, RESERVES),
  };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStoredTransaction(item) {
  return isRecord(item) && typeof item.id === 'string' && item.id.length > 0
    && isDateKey(item.date) && typeof item.title === 'string' && item.title.trim().length > 0
    && typeof item.note === 'string' && Number.isSafeInteger(item.order) && item.order > 0
    && Number.isSafeInteger(item.amount) && item.amount > 0
    && groupForKind(item.kind).some(({ id }) => id === item.category);
}

function hasSafeTotals(transactions) {
  return Number.isSafeInteger(transactions.reduce((sum, { amount }) => sum + amount, 0));
}

function readData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return DEFAULT_DATA;
  const data = JSON.parse(stored);
  if (!isRecord(data) || !Array.isArray(data.transactions)
    || !data.transactions.every(isStoredTransaction) || !hasSafeTotals(data.transactions)
    || new Set(data.transactions.map(({ id }) => id)).size !== data.transactions.length
    || !isRecord(data.budgets?.weekly) || !isRecord(data.budgets?.monthly) || !isRecord(data.goals)) {
    throw new Error('Format catatan keuangan tidak dikenali.');
  }
  try {
    return {
      transactions: data.transactions,
      budgets: { weekly: cleanedBudget(data.budgets.weekly), monthly: cleanedBudget(data.budgets.monthly) },
      goals: cleanedLimits(data.goals, RESERVES),
    };
  } catch {
    throw new Error('Format anggaran atau target simpanan tidak dikenali.');
  }
}

function readSnapshot() {
  try {
    return { data: readData(), storageError: false };
  } catch {
    return { data: DEFAULT_DATA, storageError: true };
  }
}

function validateTransfers(transactions, newDepositId) {
  const chronological = [...transactions].sort((left, right) =>
    left.date.localeCompare(right.date) || left.order - right.order);
  const balances = emptyBalances();
  for (const entry of chronological) {
    const { id, kind, category, amount } = entry;
    if (kind === 'deposit' && id === newDepositId && amount > balances.wallet) {
      throw new FinanceValidationError('Saldo uang utama pada tanggal ini belum cukup untuk setoran ini.');
    }
    if (kind === 'withdrawal' && amount > balances[category]) {
      const reserve = RESERVES.find((item) => item.id === category).label.toLowerCase();
      throw new FinanceValidationError('Saldo ' + reserve + ' pada tanggal penarikan belum cukup. Periksa setoran dan penarikan terkait.');
    }
    applyEntry(balances, entry);
  }
}

export function updateTransaction(transactions, input, today) {
  const { date, category, kind } = input;
  const title = String(input.title ?? '').trim();
  const note = String(input.note ?? '').trim();
  if (!title) throw new FinanceValidationError('Tulis nama transaksi terlebih dahulu.');
  if (title.length > 120 || note.length > 500) {
    throw new FinanceValidationError('Gunakan maksimal 120 karakter untuk nama dan 500 karakter untuk keterangan.');
  }
  if (!isDateKey(date) || date > today) throw new FinanceValidationError('Pilih tanggal transaksi yang sudah berlangsung.');
  if (!groupForKind(kind).some(({ id }) => id === category)) throw new FinanceValidationError('Pilih kategori atau simpanan.');
  const amount = wholeRupiah(input.amount);
  if (amount <= 0) throw new FinanceValidationError('Isi nominal lebih dari Rp0.');

  const previous = transactions.find(({ id }) => id === input.id);
  if (input.id && !previous) throw new FinanceValidationError('Transaksi ini sudah tidak ada di riwayat.');
  const id = previous?.id ?? (globalThis.crypto?.randomUUID?.() ?? Date.now() + '-' + Math.random().toString(36).slice(2));
  const order = previous?.order ?? transactions.reduce((last, entry) => Math.max(last, entry.order), 0) + 1;
  const transaction = { id, date, title, kind, category, amount, note, order };
  const updated = previous
    ? transactions.map((entry) => entry.id === id ? transaction : entry)
    : [...transactions, transaction];
  if (!hasSafeTotals(updated)) throw new FinanceValidationError('Jumlah transaksi terlalu besar untuk dihitung dengan tepat.');
  const depositChanged = kind === 'deposit'
    && (previous?.kind !== kind || previous.amount !== amount || previous.date !== date);
  validateTransfers(updated, depositChanged ? id : null);
  return updated;
}

export function removeTransaction(transactions, id) {
  if (!transactions.some((transaction) => transaction.id === id)) {
    throw new FinanceValidationError('Transaksi ini sudah tidak ada di riwayat.');
  }
  const updated = transactions.filter((transaction) => transaction.id !== id);
  validateTransfers(updated, null);
  return updated;
}

export function useFinance() {
  const [snapshot, setSnapshot] = useState(readSnapshot);

  useEffect(() => {
    function syncStorage(event) {
      if (event.key === STORAGE_KEY || event.key === null) {
        const next = readSnapshot();
        setSnapshot((current) => next.storageError ? { ...current, storageError: true } : next);
      }
    }
    window.addEventListener('storage', syncStorage);
    return () => window.removeEventListener('storage', syncStorage);
  }, []);

  function commit(update) {
    try {
      const next = update(readData());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSnapshot({ data: next, storageError: false });
      return '';
    } catch (error) {
      if (error instanceof FinanceValidationError) return error.message;
      setSnapshot((current) => ({ ...current, storageError: true }));
      return 'Perubahan belum tersimpan. Periksa penyimpanan browser lalu coba lagi.';
    }
  }

  return {
    ...snapshot,
    saveTransaction(input) {
      return commit((data) => ({
        ...data, transactions: updateTransaction(data.transactions, input, dayKey(new Date())),
      }));
    },
    deleteTransaction(id) {
      return commit((data) => ({
        ...data, transactions: removeTransaction(data.transactions, id),
      }));
    },
    saveBudget(period, budget) {
      return commit((data) => ({
        ...data, budgets: { ...data.budgets, [period]: cleanedBudget(budget) },
      }));
    },
    saveGoals(goals) {
      return commit((data) => ({ ...data, goals: cleanedLimits(goals, RESERVES) }));
    },
  };
}
