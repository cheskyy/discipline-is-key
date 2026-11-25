import {
  ArrowDownLeft, ArrowUpRight, ChartNoAxesColumn, ChevronDown, HardDrive, Landmark,
  List, Pencil, PiggyBank, Plus, Search, Target, Trash2, Wallet, X,
} from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  budgetTone, EXPENSE_CATEGORIES, financeBalances, financeReport, groupForKind,
  INCOME_CATEGORIES, RESERVES, rupiah, TRANSACTION_KINDS, useFinance,
} from './finance.js';
import './finance.css';

const SECTIONS = [
  { id: 'summary', label: 'Ringkasan', Icon: ChartNoAxesColumn },
  { id: 'entries', label: 'Transaksi', Icon: List },
  { id: 'budget', label: 'Anggaran', Icon: Target },
  { id: 'reserves', label: 'Simpanan', Icon: PiggyBank },
];

const PERIODS = [
  { id: 'weekly', label: 'Mingguan', summary: 'Minggu ini' },
  { id: 'monthly', label: 'Bulanan', summary: 'Bulan ini' },
];

const compactDate = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });
const formatDate = (date) => compactDate.format(new Date(date + 'T12:00:00'));

function Select({ children, ...props }) {
  return (
    <span className="select-wrapper">
      <select {...props}>{children}</select>
      <ChevronDown size={16} aria-hidden="true" />
    </span>
  );
}

function Options({ entries }) {
  return entries.map(({ id, label }) => <option key={id} value={id}>{label}</option>);
}

function PeriodPicker({ value, onChange }) {
  return (
    <div className="fin-segment" role="group" aria-label="Periode">
      {PERIODS.map(({ id, label }) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  );
}

function MoneyPair({ label, amount, className = '' }) {
  return <div className={`fin-money-pair ${className}`}><dt>{label}</dt><dd>{rupiah(amount)}</dd></div>;
}

function PeriodCard({ period, report }) {
  return (
    <section className="fin-card fin-period">
      <h3>{period.summary}</h3>
      <p className="fin-meta">{formatDate(report.from)} – {formatDate(report.to)}</p>
      <dl className="fin-period-values">
        <MoneyPair label="Pemasukan" amount={report.income} />
        <MoneyPair label="Pengeluaran" amount={report.expenses} />
        <MoneyPair label="Perubahan saldo utama" amount={report.wallet} />
      </dl>
    </section>
  );
}

function FinanceSummary({ balances, reports }) {
  const [period, setPeriod] = useState('weekly');
  const report = reports[period];
  const chartMax = report.topCategory?.amount ?? 1;

  return (
    <div className="fin-stack">
      <section className="fin-wallet" aria-labelledby="wallet-title">
        <div className="fin-wallet-main">
          <span className="fin-wallet-icon"><Wallet size={20} aria-hidden="true" /></span>
          <h2 id="wallet-title">Saldo utama</h2>
          <p className="fin-wallet-balance">{rupiah(balances.wallet)}</p>
          <p>Uang yang tersedia setelah mencatat transaksi dan simpanan.</p>
        </div>
        <dl className="fin-wallet-details">
          <MoneyPair label="Total pemasukan" amount={balances.income} />
          <MoneyPair label="Total pengeluaran" amount={balances.expenses} />
          <MoneyPair label="Tabungan pribadi" amount={balances.savings} />
          <MoneyPair label="Dana darurat" amount={balances.emergency} />
        </dl>
      </section>

      <div className="fin-columns">
        {PERIODS.map((item) => <PeriodCard key={item.id} period={item} report={reports[item.id]} />)}
      </div>

      <section className="fin-card" aria-labelledby="chart-title">
        <div className="fin-section-head">
          <div>
            <h2 id="chart-title">Pengeluaran per kategori</h2>
            <p className="muted">Lihat ke mana uangmu paling banyak digunakan.</p>
          </div>
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
        {report.byCategory.length ? (
          <ul className="fin-chart">
            {report.byCategory.map(({ id, label, amount }) => (
              <li key={id}>
                <div><span>{label}</span><strong>{rupiah(amount)}</strong></div>
                <div className="fin-bar" aria-hidden="true">
                  <span style={{ '--fin-progress': `${amount / chartMax * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="fin-empty-line">Belum ada pengeluaran pada periode ini.</p>}
        <dl className="fin-chart-foot">
          <div className="fin-money-pair"><dt>Pengeluaran terbesar</dt><dd>{report.topCategory?.label ?? 'Belum ada'}</dd></div>
          <MoneyPair label="Tabungan bersih" amount={report.savings} />
          <MoneyPair label="Dana darurat bersih" amount={report.emergency} />
        </dl>
      </section>
    </div>
  );
}

function reverseChronological(entries) {
  return [...entries].sort((first, second) =>
    second.date.localeCompare(first.date) || second.order - first.order);
}

function TransactionList({ entries, onEdit, onDelete, reservePerspective = false, empty = 'Belum ada transaksi.' }) {
  if (!entries.length) return <p className="fin-empty-line">{empty}</p>;

  return (
    <table className="fin-transactions" role="table" aria-label="Daftar transaksi">
      <thead>
        <tr role="row">
          <th scope="col">Nama</th>
          <th scope="col">Tanggal dan kategori</th>
          <th scope="col">Jenis</th>
          <th scope="col" className="fin-amount-heading">Nominal</th>
          <th scope="col" className="fin-action-heading">Tindakan</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const kind = TRANSACTION_KINDS.find(({ id }) => id === entry.kind);
          const category = groupForKind(entry.kind).find(({ id }) => id === entry.category);
          const incoming = reservePerspective
            ? entry.kind === 'deposit'
            : entry.kind === 'income' || entry.kind === 'withdrawal';
          const Direction = incoming ? ArrowDownLeft : ArrowUpRight;
          const iconKind = reservePerspective ? (incoming ? 'income' : 'expense') : entry.kind;
          return (
            <tr key={entry.id} className="fin-transaction" role="row">
              <td className="fin-trans-name" role="cell">
                <div>
                  <span className={`fin-trans-icon fin-kind-${iconKind}`}><Direction size={17} aria-hidden="true" /></span>
                  <div className="fin-trans-info">
                    <strong>{entry.title}</strong>
                    {entry.note && <p className="fin-note">{entry.note}</p>}
                  </div>
                </div>
              </td>
              <td className="fin-trans-meta" role="cell">
                <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                <span>{category?.label}</span>
              </td>
              <td className="fin-trans-kind" role="cell"><span className={`fin-kind fin-kind-${entry.kind}`}>{kind?.label}</span></td>
              <td className={`fin-trans-amount ${incoming ? 'fin-incoming' : ''}`} role="cell">
                <span aria-hidden="true">{incoming ? '+' : '−'}</span>
                <span className="sr-only">{incoming ? 'Masuk ' : 'Keluar '}</span>{rupiah(entry.amount)}
              </td>
              <td className="fin-trans-actions" role="cell">
                <div>
                  <button type="button" className="icon-button" title="Edit transaksi" aria-label={`Edit ${entry.title}`} onClick={() => onEdit(entry)}>
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-button delete-action" title="Hapus transaksi" aria-label={`Hapus ${entry.title}`} onClick={() => onDelete(entry)}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TransactionHistory({ entries, today, onEdit, onDelete }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const searchTerm = query.trim().toLocaleLowerCase('id-ID');
  const invalidRange = start && end && start > end;
  const filtered = entries.filter((entry) =>
    (!start || entry.date >= start) && (!end || entry.date <= end)
    && (!category || entry.category === category)
    && entry.title.toLocaleLowerCase('id-ID').includes(searchTerm));

  return (
    <section className="fin-card" aria-labelledby="trans-title">
      <div className="fin-section-head">
        <div>
          <h2 id="trans-title">Riwayat transaksi</h2>
          <p className="muted">Gunakan tanggal, kategori, atau nama untuk menemukan transaksi.</p>
        </div>
      </div>
      <div className="fin-filters">
        <label className="form-field fin-search">
          <span>Cari nama transaksi</span>
          <span><Search size={17} aria-hidden="true" /><input type="search" placeholder="Misalnya, bensin" value={query} onChange={(event) => setQuery(event.target.value)} /></span>
        </label>
        <label className="form-field">
          <span>Kategori</span>
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Semua kategori</option>
            <optgroup label="Pemasukan"><Options entries={INCOME_CATEGORIES} /></optgroup>
            <optgroup label="Pengeluaran"><Options entries={EXPENSE_CATEGORIES} /></optgroup>
            <optgroup label="Simpanan"><Options entries={RESERVES} /></optgroup>
          </Select>
        </label>
        <label className="form-field">
          <span>Dari tanggal</span>
          <input type="date" max={today} value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label className="form-field">
          <span>Sampai tanggal</span>
          <input type="date" max={today} value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
      </div>
      {invalidRange
        ? <p className="field-error" role="alert">Tanggal akhir harus sama dengan atau setelah tanggal awal.</p>
        : <TransactionList entries={reverseChronological(filtered)} onEdit={onEdit} onDelete={onDelete}
            empty={entries.length ? 'Tidak ada transaksi yang cocok dengan pilihanmu.' : 'Belum ada transaksi. Pilih Catat transaksi untuk memulai.'} />}
    </section>
  );
}

function ProgressLine({ label, value, limit, kind }) {
  const tone = budgetTone(value, limit);
  const percent = Math.min(100, Math.max(0, tone.percent));
  return (
    <div className={`fin-progress fin-tone-${kind === 'spending' ? tone.level : 'normal'}`}>
      <div className="fin-progress-head">
        <strong>{label}</strong>
        {limit && kind === 'spending' && tone.label && <span className="fin-alert">{tone.label}</span>}
      </div>
      {limit ? (
        <>
          <p>{rupiah(value)} dari {rupiah(limit)} <span className="fin-meta">({Math.max(0, Math.round(tone.percent))}%)</span></p>
          <div className="fin-bar" aria-hidden="true"><span style={{ '--fin-progress': `${percent}%` }} /></div>
        </>
      ) : (
        <p>{rupiah(value)} · {kind === 'spending' ? 'Batas belum ditetapkan' : 'Target belum ditetapkan'}</p>
      )}
    </div>
  );
}

function BudgetView({ budgets, reports, openBudget }) {
  const [period, setPeriod] = useState('weekly');
  const budget = budgets[period];
  const report = reports[period];
  const categoryLimits = EXPENSE_CATEGORIES.filter(({ id }) => budget.categories[id]);
  return (
    <div className="fin-stack">
      <section className="fin-card" aria-labelledby="budget-title">
        <div className="fin-section-head">
          <div>
            <h2 id="budget-title">Batas pengeluaran</h2>
            <p className="muted">Pantau pengeluaran berjalan dan sesuaikan batas kapan saja.</p>
          </div>
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
        <div className="fin-budget-main">
          <ProgressLine label={period === 'weekly' ? 'Total mingguan' : 'Total bulanan'} value={report.expenses} limit={budget.total} kind="spending" />
          <p className="fin-meta">{formatDate(report.from)} – {formatDate(report.to)}</p>
        </div>
        <button type="button" className="button secondary" onClick={() => openBudget(period)}>
          <Pencil size={15} aria-hidden="true" /> Edit anggaran
        </button>
      </section>
      <div className="fin-columns">
        <section className="fin-card">
          <h3>Batas per kategori</h3>
          {categoryLimits.length ? <div className="fin-progress-list">
            {categoryLimits.map(({ id, label }) => (
              <ProgressLine key={id} label={label} value={report.byCategory.find((entry) => entry.id === id)?.amount ?? 0}
                limit={budget.categories[id]} kind="spending" />
            ))}
          </div> : <p className="fin-empty-line">Belum ada batas per kategori. Atur melalui Edit anggaran.</p>}
        </section>
        <section className="fin-card">
          <h3>Rencana simpanan</h3>
          <p className="fin-meta fin-section-note">Dihitung dari setoran setelah dikurangi penarikan pada periode ini.</p>
          <div className="fin-progress-list">
            {RESERVES.map(({ id, label }) => (
              <ProgressLine key={id} label={label} value={report[id]} limit={budget.allocations[id]} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ReservesView({ balances, transactions, goals, openGoals, openTransfer, onEdit, onDelete }) {
  return (
    <div className="fin-stack">
      <section className="fin-card" aria-labelledby="reserves-title">
        <div className="fin-section-head">
          <div>
            <h2 id="reserves-title">Simpanan dan target</h2>
            <p className="muted">Pindahkan uang dari saldo utama dan pantau target tiap simpanan.</p>
          </div>
          <button type="button" className="button secondary" onClick={openGoals}><Target size={16} aria-hidden="true" /> Atur target</button>
        </div>
        <div className="fin-columns fin-reserve-grid">
          {RESERVES.map(({ id, label }) => {
            const Icon = id === 'savings' ? PiggyBank : Landmark;
            return (
              <section className="fin-reserve-card" key={id}>
                <h3><Icon size={20} aria-hidden="true" /> {label}</h3>
                <p className="fin-reserve-balance">{rupiah(balances[id])}</p>
                <ProgressLine label="Target simpanan" value={balances[id]} limit={goals[id]} />
                <button type="button" className="button secondary" aria-label={`Setor atau tarik ${label}`} onClick={() => openTransfer(id)}>
                  Setor atau tarik
                </button>
              </section>
            );
          })}
        </div>
      </section>
      {RESERVES.map(({ id, label }) => (
        <section key={id} className="fin-card">
          <h3>Riwayat {label.toLocaleLowerCase('id-ID')}</h3>
          <TransactionList entries={reverseChronological(transactions.filter(({ category, kind }) =>
            category === id && (kind === 'deposit' || kind === 'withdrawal')))}
            onEdit={onEdit} onDelete={onDelete} reservePerspective empty="Belum ada setoran atau penarikan." />
        </section>
      ))}
    </div>
  );
}

function FinanceDialog({ title, submitLabel, danger, children, onSubmit, onClose }) {
  const dialog = useRef(null);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    const element = dialog.current;
    element.showModal();
    element.querySelector('[data-focus]')?.focus();
  }, []);

  function close() {
    dialog.current.close();
    onClose();
  }

  function submit(event) {
    event.preventDefault();
    const message = onSubmit(new FormData(event.currentTarget));
    if (message) setError(message);
    else close();
  }

  return (
    <dialog ref={dialog} className="task-dialog fin-dialog" aria-labelledby="fin-dialog-title"
      onCancel={(event) => { event.preventDefault(); close(); }}>
      <form noValidate onSubmit={submit}>
        <div className="dialog-head">
          <h2 className="section-heading" id="fin-dialog-title">{title}</h2>
          <button className="icon-button" type="button" onClick={close} aria-label="Tutup">
            <X size={21} aria-hidden="true" />
          </button>
        </div>
        {children}
        {error && <p className="fin-form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="button secondary" type="button" data-focus={danger || undefined} onClick={close}>Batal</button>
          <button className={`button ${danger ? 'danger' : 'primary'}`} type="submit">{submitLabel}</button>
        </div>
      </form>
    </dialog>
  );
}

function MoneyInput({ label, name, amount, required, focus }) {
  return (
    <label className="form-field fin-money-input">
      <span>{label}</span>
      <span className="fin-input-affix">
        <span aria-hidden="true">Rp</span>
        <input type="text" name={name} inputMode="numeric" required={required} data-focus={focus || undefined}
          autoComplete="off" placeholder={required ? '25000' : 'Kosong'} defaultValue={amount ?? ''} />
      </span>
    </label>
  );
}

function TransactionEditor({ entry, reserve, today, onSubmit, onClose }) {
  const [kind, setKind] = useState(entry?.kind ?? (reserve ? 'deposit' : 'expense'));
  const [category, setCategory] = useState(entry?.category ?? reserve ?? '');
  const categoryLabel = kind === 'deposit' ? 'Simpan ke' : kind === 'withdrawal' ? 'Ambil dari' : 'Kategori';

  function changeKind(event) {
    const next = event.target.value;
    setKind(next);
    if (!groupForKind(next).some(({ id }) => id === category)) setCategory('');
  }

  return (
    <FinanceDialog title={entry ? 'Edit transaksi' : 'Catat transaksi'} submitLabel="Simpan transaksi" onClose={onClose}
      onSubmit={(values) => onSubmit({ ...Object.fromEntries(values), id: entry?.id })}>
      <p className="muted fin-dialog-note">Masukkan nominal dalam Rupiah, misalnya 25000 atau 25.000.</p>
      <div className="fin-form-grid">
        <label className="form-field">
          <span>Jenis transaksi</span>
          <Select name="kind" value={kind} onChange={changeKind}><Options entries={TRANSACTION_KINDS} /></Select>
        </label>
        <label className="form-field">
          <span>Tanggal</span>
          <input type="date" name="date" min="1900-01-01" max={today} defaultValue={entry?.date ?? today} required />
        </label>
      </div>
      <label className="form-field">
        <span>Nama transaksi</span>
        <input name="title" type="text" maxLength={120} placeholder="Misalnya, beli makan siang" required
          defaultValue={entry?.title ?? ''} data-focus />
      </label>
      <div className="fin-form-grid">
        <label className="form-field">
          <span>{categoryLabel}</span>
          <Select name="category" value={category} onChange={(event) => setCategory(event.target.value)} required>
            <option value="">{categoryLabel === 'Kategori' ? 'Pilih kategori' : 'Pilih simpanan'}</option>
            <Options entries={groupForKind(kind)} />
          </Select>
        </label>
        <MoneyInput label="Nominal (Rp)" name="amount" amount={entry?.amount} required />
      </div>
      <label className="form-field">
        <span>Catatan (opsional)</span>
        <textarea name="note" rows={2} maxLength={500} defaultValue={entry?.note ?? ''} />
      </label>
    </FinanceDialog>
  );
}

function BudgetEditor({ period, budget, onSubmit, onClose }) {
  const periodLabel = PERIODS.find(({ id }) => id === period).label.toLowerCase();
  return (
    <FinanceDialog title={`Edit anggaran ${periodLabel}`} submitLabel="Simpan anggaran" onClose={onClose}
      onSubmit={(values) => onSubmit(period, {
        total: values.get('total'),
        categories: Object.fromEntries(EXPENSE_CATEGORIES.map(({ id }) => [id, values.get(id)])),
        allocations: Object.fromEntries(RESERVES.map(({ id }) => [id, values.get(id)])),
      })}>
      <p className="muted fin-dialog-note">Isi angka dalam Rupiah. Kosongkan kolom untuk menghapus batas atau rencana.</p>
      <MoneyInput label="Batas total pengeluaran (Rp)" name="total" amount={budget.total} focus />
      <fieldset className="fin-fieldset">
        <legend>Batas per kategori</legend>
        <div className="fin-form-grid">
          {EXPENSE_CATEGORIES.map(({ id, label }) =>
            <MoneyInput key={id} name={id} label={label} amount={budget.categories[id]} />)}
        </div>
      </fieldset>
      <fieldset className="fin-fieldset">
        <legend>Rencana simpanan</legend>
        <div className="fin-form-grid">
          {RESERVES.map(({ id, label }) => <MoneyInput key={id} name={id} label={label} amount={budget.allocations[id]} />)}
        </div>
      </fieldset>
    </FinanceDialog>
  );
}

function GoalsEditor({ goals, onSubmit, onClose }) {
  return (
    <FinanceDialog title="Atur target simpanan" submitLabel="Simpan target" onClose={onClose}
      onSubmit={(values) => onSubmit(Object.fromEntries(values))}>
      <p className="muted fin-dialog-note">Isi target dalam Rupiah. Kosongkan kolom untuk menghapus target.</p>
      {RESERVES.map(({ id, label }, index) =>
        <MoneyInput key={id} name={id} label={`Target ${label.toLowerCase()} (Rp)`} amount={goals[id]} focus={index === 0} />)}
    </FinanceDialog>
  );
}

export default function Finance({ today }) {
  const { data, storageError, saveTransaction, deleteTransaction, saveBudget, saveGoals } = useFinance();
  const [section, setSection] = useState('summary');
  const [modal, setModal] = useState(null);
  const addButton = useRef(null);
  const modalTrigger = useRef(null);
  const { transactions, budgets, goals } = data;
  const balances = financeBalances(transactions);
  const reports = {
    weekly: financeReport(transactions, today, 'weekly'),
    monthly: financeReport(transactions, today, 'monthly'),
  };

  function openModal(details) {
    modalTrigger.current = document.activeElement;
    setModal(details);
  }

  function closeModal() {
    setModal(null);
    requestAnimationFrame(() => {
      const trigger = modalTrigger.current;
      if (trigger?.isConnected) trigger.focus();
      else addButton.current?.focus();
    });
  }

  const onEdit = (entry) => openModal({ name: 'transaction', entry });
  const onDelete = (entry) => openModal({ name: 'delete', entry });

  return (
    <div className="finance">
      <header className="page-header">
        <div>
          <h1>Keuanganku</h1>
          <p className="muted">Catat uang masuk dan keluar, lalu sisihkan uang untuk tujuanmu.</p>
        </div>
        <button ref={addButton} type="button" className="button primary" onClick={() => openModal({ name: 'transaction' })}>
          <Plus size={19} aria-hidden="true" /> Catat transaksi
        </button>
      </header>

      {storageError && <p className="storage-warning" role="alert">Perubahan keuangan belum bisa tersimpan. Biarkan halaman ini terbuka agar catatanmu tetap terlihat.</p>}
      <nav className="fin-nav" aria-label="Bagian Keuanganku">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button key={id} type="button" aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>
            <Icon size={17} aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>

      {section === 'summary' && <FinanceSummary balances={balances} reports={reports} />}
      {section === 'entries' && <TransactionHistory entries={transactions} today={today} onEdit={onEdit} onDelete={onDelete} />}
      {section === 'budget' && <BudgetView budgets={budgets} reports={reports} openBudget={(period) => openModal({ name: 'budget', period })} />}
      {section === 'reserves' && <ReservesView balances={balances} transactions={transactions} goals={goals}
        onEdit={onEdit} onDelete={onDelete} openGoals={() => openModal({ name: 'goals' })}
        openTransfer={(reserve) => openModal({ name: 'transaction', reserve })} />}

      {modal?.name === 'transaction' && <TransactionEditor entry={modal.entry} reserve={modal.reserve} today={today} onSubmit={saveTransaction} onClose={closeModal} />}
      {modal?.name === 'delete' && (
        <FinanceDialog title="Hapus transaksi?" submitLabel="Hapus transaksi" danger
          onSubmit={() => deleteTransaction(modal.entry.id)} onClose={closeModal}>
          <p className="muted delete-detail">Transaksi <strong>{modal.entry.title}</strong> akan dihapus dan saldo akan dihitung ulang.</p>
        </FinanceDialog>
      )}
      {modal?.name === 'budget' && <BudgetEditor period={modal.period} budget={budgets[modal.period]} onSubmit={saveBudget} onClose={closeModal} />}
      {modal?.name === 'goals' && <GoalsEditor goals={goals} onSubmit={saveGoals} onClose={closeModal} />}
      <footer className="page-footer">
        <span><HardDrive size={15} aria-hidden="true" /> {storageError ? 'Penyimpanan sedang terganggu' : 'Tersimpan di browser ini'}</span>
        <span className="mobile-tagline">Small Steps. Consistent Actions. Better Me.</span>
      </footer>
    </div>
  );
}
