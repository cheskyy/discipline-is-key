import {
  BookOpen, CalendarDays, Check, ChevronDown, ClipboardList, HardDrive,
  Home, Pencil, Plus, Sprout, Target, Trash2, Wallet, X,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CATEGORIES, dailyQuote, dayKey, dayLabel, greeting, useAgenda, useClock } from './agenda.js';
import Finance from './Finance.jsx';

const ASSETS = `${import.meta.env.BASE_URL}assets/`;
const EMPTY_TASKS = [];
const NAVIGATION = [
  { id: 'hari-ini', label: 'Hari Ini', Icon: Home },
  { id: 'checklist', label: 'Checklist Harian', Icon: ClipboardList },
  { id: 'keuanganku', label: 'Keuanganku', Icon: Wallet },
];

function pageFromHash() {
  const id = window.location.hash.slice(1);
  return NAVIGATION.find((item) => item.id === id)?.id;
}

function usePage() {
  const [page, setPage] = useState(() => pageFromHash() ?? 'hari-ini');

  useEffect(() => {
    function navigate() {
      const nextPage = pageFromHash();
      if (window.location.hash && !nextPage) return;
      setPage(nextPage ?? 'hari-ini');
      window.scrollTo({ top: 0 });
    }
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  return page;
}

function Sidebar({ page }) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#hari-ini" aria-label="DISCIPLINE IS KEY, Hari Ini">
        <img src={`${ASSETS}mark.svg`} alt="" width="45" height="45" />
        <span>DISCIPLINE<br />IS KEY<span className="brand-period">.</span></span>
      </a>
      <nav className="navigation" aria-label="Menu utama">
        {NAVIGATION.map(({ id, label, Icon }) => (
          <a key={id} className="nav-link" href={`#${id}`} aria-current={id === page ? 'page' : undefined}>
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="sidebar-footer">
        <Sprout size={20} aria-hidden="true" />
        <p>Small Steps.<br />Consistent Actions.<br />Better Me.</p>
      </div>
    </aside>
  );
}

function Dashboard({ now, today, tasks }) {
  const doneCount = tasks.filter((task) => task.done).length;
  const progress = tasks.length ? Math.round(doneCount / tasks.length * 100) : 0;
  const categories = CATEGORIES.map((category) => {
    const entries = tasks.filter((task) => task.category === category.id);
    return { ...category, total: entries.length, done: entries.filter((task) => task.done).length };
  }).filter((category) => category.total > 0);

  return (
    <>
      <section className="hero" aria-labelledby="greeting">
        <img className="hero-image" src={`${ASSETS}planner-hero.webp`} alt="" />
        <div className="hero-copy">
          <h2 id="greeting">{greeting(now)}.</h2>
          <p>{dailyQuote(today)}</p>
        </div>
      </section>

      <div className="summary-grid">
        <section className="summary-card progress-card" aria-labelledby="progress-title">
          <div>
            <h2 className="card-heading" id="progress-title"><Check aria-hidden="true" /> Progres hari ini</h2>
            <p className="progress-number">{progress}<span>%</span></p>
            <p className="muted">{doneCount} dari {tasks.length} kegiatan selesai</p>
          </div>
          <div
            className="progress-ring"
            role="progressbar"
            aria-labelledby="progress-title"
            aria-valuenow={progress}
            style={{ '--progress': `${progress}%` }}
          >
            <span><Sprout size={31} strokeWidth={1.35} aria-hidden="true" /></span>
          </div>
        </section>

        <section className="summary-card" aria-labelledby="target-title">
          <h2 className="card-heading" id="target-title"><Target aria-hidden="true" /> Target hari ini</h2>
          {categories.length ? (
            <ul className="target-list">
              {categories.map(({ id, label, total, done }) => (
                <li key={id}>
                  <span className={`category-dot category-${id}`} aria-hidden="true" />
                  <span>{label}</span>
                  <span className="target-count">
                    <span aria-hidden="true">{done}/{total}</span>
                    <span className="sr-only">{done} dari {total} selesai</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="target-empty muted">Tambahkan kegiatan untuk mulai menyusun target hari ini.</p>}
        </section>
      </div>
    </>
  );
}

function TaskRow({ task, grouped, onToggle, onEdit, onDelete }) {
  const category = CATEGORIES.find(({ id }) => id === task.category);

  return (
    <li className="task-row">
      <label className="task-check">
        <input type="checkbox" checked={task.done} onChange={() => onToggle(task.id)} />
        <span className="check-box" aria-hidden="true"><Check size={15} strokeWidth={2.5} /></span>
        <span className="task-name">{task.title}</span>
      </label>
      {!grouped && category && (
        <span className={`category-tag category-${category.id}`}>{category.label}</span>
      )}
      <div className="task-actions">
        <button type="button" className="icon-button" title="Edit kegiatan" aria-label={`Edit ${task.title}`} onClick={(event) => onEdit(task, event.currentTarget)}>
          <Pencil size={16} aria-hidden="true" />
        </button>
        <button type="button" className="icon-button delete-action" title="Hapus kegiatan" aria-label={`Hapus ${task.title}`} onClick={(event) => onDelete(task, event.currentTarget)}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function Checklist({ date, tasks, grouped, changeDay, openDialog }) {
  const [status, setStatus] = useState('semua');
  const [category, setCategory] = useState('');
  const visible = tasks.filter((task) => (!category || task.category === category) && (status !== 'belum' || !task.done));
  const remaining = tasks.filter((task) => !task.done).length;

  function renderTask(task) {
    return (
      <TaskRow
        key={task.id}
        task={task}
        grouped={grouped}
        onToggle={(id) => changeDay(date, (items) => items.map((item) => item.id === id ? { ...item, done: !item.done } : item))}
        onEdit={(item, trigger) => openDialog({ type: 'edit', item, date, trigger })}
        onDelete={(item, trigger) => openDialog({ type: 'delete', item, date, trigger })}
      />
    );
  }

  return (
    <section className="checklist" aria-labelledby="checklist-title">
      <div className="checklist-head">
        <div>
          <h2 className="section-heading" id="checklist-title">Daftar kegiatan</h2>
          <p className="muted">Centang kegiatan yang sudah kamu selesaikan.</p>
        </div>
        <button className="button primary add-button" type="button" onClick={(event) => openDialog({ type: 'add', date, category, trigger: event.currentTarget })}>
          <Plus size={19} aria-hidden="true" /> Tambah kegiatan
        </button>
      </div>

      <div className="checklist-tools">
        <div className="status-filter" role="group" aria-label="Status kegiatan">
          <button type="button" aria-pressed={status === 'semua'} onClick={() => setStatus('semua')}>Semua <span>{tasks.length}</span></button>
          <button type="button" aria-pressed={status === 'belum'} onClick={() => setStatus('belum')}>Belum selesai <span>{remaining}</span></button>
        </div>
        <label className="select-wrapper filter-select">
          <span className="sr-only">Saring berdasarkan kategori</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Semua kategori</option>
            {CATEGORIES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </label>
      </div>

      {!visible.length && (
        <div className="empty-state" aria-live="polite">
          <BookOpen size={25} strokeWidth={1.6} aria-hidden="true" />
          <p>{tasks.length === 0 ? 'Belum ada kegiatan.' : 'Tidak ada kegiatan yang cocok.'}</p>
          <p className="muted">{tasks.length === 0 ? 'Pilih Tambah kegiatan untuk mulai membuat rencana.' : 'Pilih Semua atau ganti kategori untuk melihat kegiatan lain.'}</p>
        </div>
      )}

      {visible.length > 0 && !grouped && <ul className="task-list">{visible.map(renderTask)}</ul>}
      {visible.length > 0 && grouped && (
        <div className="task-groups">
          {CATEGORIES.map(({ id, label }) => {
            const entries = visible.filter((task) => task.category === id);
            if (!entries.length) return null;
            return (
              <section key={id} aria-labelledby={`group-${id}`}>
                <h3 className="group-title" id={`group-${id}`}>
                  <span className={`category-dot category-${id}`} aria-hidden="true" /> {label}
                </h3>
                <ul className="task-list">{entries.map(renderTask)}</ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TaskDialog({ details, onClose, onSave }) {
  const { type, item, date, category } = details;
  const [title, setTitle] = useState(item?.title ?? '');
  const [selectedCategory, setSelectedCategory] = useState(item?.category ?? (category || CATEGORIES[0].id));
  const [error, setError] = useState('');
  const dialog = useRef(null);
  const titleInput = useRef(null);
  const cancelButton = useRef(null);
  const isDelete = type === 'delete';

  useLayoutEffect(() => {
    dialog.current.showModal();
    if (isDelete) cancelButton.current.focus();
    else titleInput.current.focus();
  }, [isDelete]);

  function submit(event) {
    event.preventDefault();
    if (isDelete) {
      onSave();
      return;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Tulis nama kegiatan terlebih dahulu.');
      titleInput.current.focus();
      return;
    }
    onSave({ title: cleanTitle, category: selectedCategory });
  }

  return (
    <dialog
      ref={dialog}
      className="task-dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <form onSubmit={submit} noValidate>
        <div className="dialog-head">
          <h2 className="section-heading" id="dialog-title">{isDelete ? 'Hapus kegiatan?' : type === 'edit' ? 'Edit kegiatan' : 'Tambah kegiatan'}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Tutup"><X size={21} aria-hidden="true" /></button>
        </div>
        {isDelete ? (
          <p className="muted delete-detail">Kegiatan <strong>{item.title}</strong> akan dihapus dari daftar.</p>
        ) : (
          <>
            <p className="muted dialog-date">{dayLabel(date)}</p>
            <label className="form-field">
              <span>Nama kegiatan</span>
              <input
                ref={titleInput}
                type="text"
                value={title}
                maxLength={140}
                aria-required="true"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'task-error' : undefined}
                placeholder="Misalnya, baca 10 halaman"
                onChange={(event) => { setTitle(event.target.value); setError(''); }}
              />
            </label>
            {error && <p className="field-error" id="task-error" role="alert">{error}</p>}
            <label className="form-field">
              <span>Kategori</span>
              <span className="select-wrapper">
                <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                  {CATEGORIES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </span>
            </label>
          </>
        )}
        <div className="dialog-actions">
          <button ref={cancelButton} className="button secondary" type="button" onClick={onClose}>Batal</button>
          <button className={`button ${isDelete ? 'danger' : 'primary'}`} type="submit">{isDelete ? 'Hapus kegiatan' : 'Simpan kegiatan'}</button>
        </div>
      </form>
    </dialog>
  );
}

export default function App() {
  const page = usePage();
  const now = useClock();
  const today = dayKey(now);
  const { days, storageError, changeDay } = useAgenda();
  const [chosenDate, setChosenDate] = useState('');
  const [dialog, setDialog] = useState(null);
  const isTodayPage = page === 'hari-ini';
  const date = isTodayPage ? today : chosenDate || today;
  const tasks = days[date] ?? EMPTY_TASKS;

  function closeDialog() {
    const trigger = dialog.trigger;
    setDialog(null);
    window.requestAnimationFrame(() => {
      if (trigger.isConnected) trigger.focus();
      else document.querySelector('.add-button')?.focus();
    });
  }

  function saveDialog(values) {
    const { type, date: editDate, item } = dialog;
    if (type === 'add') {
      const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      changeDay(editDate, (items) => [...items, { id, ...values, done: false }]);
    } else if (type === 'edit') {
      changeDay(editDate, (items) => items.map((task) => task.id === item.id ? { ...task, ...values } : task));
    } else {
      changeDay(editDate, (items) => items.filter((task) => task.id !== item.id));
    }
    closeDialog();
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#konten" onClick={(event) => {
        event.preventDefault();
        document.getElementById('konten').focus();
      }}>Lompat ke isi halaman</a>
      <Sidebar page={page} />
      <main id="konten" tabIndex={-1} className="page">
        {page === 'keuanganku' ? <Finance today={today} /> : (
          <>
            <header className="page-header">
              <div>
                <h1>{isTodayPage ? 'Hari ini' : 'Checklist harian'}</h1>
                {!isTodayPage && <p className="muted">Pilih tanggal untuk melihat atau mengatur kegiatanmu.</p>}
              </div>
              {isTodayPage ? (
                <time className="date-badge" dateTime={today}><CalendarDays size={17} aria-hidden="true" /> {dayLabel(today)}</time>
              ) : (
                <div className="date-controls">
                  <label className="date-badge date-input">
                    <span>Tanggal</span>
                    <input type="date" required min="1900-01-01" max="9999-12-31" value={date} onChange={(event) => {
                      if (event.target.validity.valid) setChosenDate(event.target.value === today ? '' : event.target.value);
                    }} />
                  </label>
                  {date !== today && <button className="button secondary today-button" type="button" onClick={() => setChosenDate('')}>Hari ini</button>}
                </div>
              )}
            </header>

            {storageError && <p className="storage-warning" role="alert">Perubahan belum bisa tersimpan. Biarkan halaman ini terbuka agar perubahanmu tetap terlihat.</p>}
            {isTodayPage && <Dashboard now={now} today={today} tasks={tasks} />}
            <Checklist key={page} date={date} tasks={tasks} grouped={!isTodayPage} changeDay={changeDay} openDialog={setDialog} />
            <footer className="page-footer">
              <span><HardDrive size={15} aria-hidden="true" /> {storageError ? 'Penyimpanan sedang terganggu' : 'Tersimpan di browser ini'}</span>
              <span className="mobile-tagline">Small Steps. Consistent Actions. Better Me.</span>
            </footer>
          </>
        )}
      </main>
      {dialog && <TaskDialog details={dialog} onClose={closeDialog} onSave={saveDialog} />}
    </div>
  );
}
