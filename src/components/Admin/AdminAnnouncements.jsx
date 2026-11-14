// Admin → Duyurular: sitedeki /announcements sayfasında görünen duyuruları ekle, düzenle, sil.
import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Pencil, Pin, Plus, Trash2, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { toDate } from '../../lib/db';
import { loggedWrite } from '../../lib/adminLog';

const ANN_TYPES = [
  ['update', 'Güncelleme'],
  ['new', 'Yeni ürün'],
  ['info', 'Bilgi'],
  ['warning', 'Uyarı / bakım'],
];
const EMPTY = { title: '', body: '', title_en: '', body_en: '', type: 'update', pinned: false };

const AnnouncementForm = ({ initial, me, onClose }) => {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return toast.error('Başlık ve metin gerekli.');
    const data = {
      title: form.title.trim().slice(0, 120),
      body: form.body.trim().slice(0, 4000),
      title_en: (form.title_en || '').trim().slice(0, 120),
      body_en: (form.body_en || '').trim().slice(0, 4000),
      type: form.type,
      pinned: !!form.pinned,
      updated_at: serverTimestamp(),
    };
    setSaving(true);
    try {
      if (initial?.id) {
        await loggedWrite({ me, mode: 'update', collectionName: 'announcements', id: initial.id, targetType: 'announcement', data, summary: `Duyuru düzenlendi: "${data.title}"` });
      } else {
        await loggedWrite({ me, mode: 'create', collectionName: 'announcements', targetType: 'announcement', data: { ...data, created_at: serverTimestamp() }, summary: `Duyuru yayınlandı: "${data.title}"` });
      }
      toast.success('Duyuru kaydedildi');
      onClose();
    } catch (err) {
      toast.error('Kaydedilemedi: ' + (err.code || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <form className="adm-drawer" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <header className="adm-drawer-head">
          <h2>{initial?.id ? 'Duyuruyu düzenle' : 'Yeni duyuru'}</h2>
          <button type="button" className="adm-icon-btn" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </header>
        <div className="adm-drawer-body">
          <div className="adm-grid-2">
            <label className="adm-field">
              <span className="adm-label">Tür</span>
              <select className="adm-input" value={form.type} onChange={set('type')}>
                {ANN_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="adm-switch" style={{ alignSelf: 'end', marginBottom: 10 }}>
              <input type="checkbox" checked={form.pinned} onChange={set('pinned')} />
              <span className="adm-switch-track"><span /></span>
              En üste sabitle
            </label>
          </div>
          <label className="adm-field">
            <span className="adm-label">Başlık *</span>
            <input className="adm-input" value={form.title} onChange={set('title')} maxLength={120} required />
          </label>
          <label className="adm-field">
            <span className="adm-label">Metin *</span>
            <textarea className="adm-input" rows={8} value={form.body} onChange={set('body')} required />
          </label>
          <details className="adm-en-block" open={!!(form.title_en || form.body_en)}>
            <summary>İngilizce (EN) — boş bırakılırsa Türkçesi gösterilir</summary>
            <label className="adm-field">
              <span className="adm-label">Title (EN)</span>
              <input className="adm-input" value={form.title_en} onChange={set('title_en')} maxLength={120} />
            </label>
            <label className="adm-field">
              <span className="adm-label">Text (EN)</span>
              <textarea className="adm-input" rows={6} value={form.body_en} onChange={set('body_en')} />
            </label>
          </details>
        </div>
        <footer className="adm-drawer-foot">
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>Vazgeç</button>
          <button className="adm-btn adm-btn-primary" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Yayınla'}</button>
        </footer>
      </form>
    </div>
  );
};

const AdminAnnouncements = ({ me }) => {
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'announcements'), orderBy('created_at', 'desc')),
        (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => toast.error('Duyurular okunamadı: ' + err.code),
      ),
    [],
  );

  const remove = async (a) => {
    if (!confirm(`"${a.title}" duyurusu silinsin mi?`)) return;
    try {
      await loggedWrite({ me, mode: 'delete', collectionName: 'announcements', id: a.id, current: a, targetType: 'announcement', summary: `Duyuru silindi: "${a.title}"` });
      toast.success('Duyuru silindi');
    } catch (err) {
      toast.error('Silinemedi: ' + (err.code || err.message));
    }
  };

  const typeLabel = Object.fromEntries(ANN_TYPES);

  return (
    <section className="adm-card">
      <div className="adm-card-head adm-card-pad">
        <div>
          <h2 className="adm-card-title">Duyurular</h2>
          <p className="adm-muted">Sitedeki “Duyurular” sayfasında yayınlanır; yeni duyuruda üst bardaki menüde kırmızı nokta çıkar.</p>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={() => setEditing({})}><Plus size={15} /> Yeni duyuru</button>
      </div>
      {list === null ? (
        <p className="adm-muted adm-card-pad">Yükleniyor…</p>
      ) : !list.length ? (
        <p className="adm-muted adm-card-pad">Henüz duyuru yok.</p>
      ) : (
        <ul className="adm-ann-list">
          {list.map((a) => (
            <li key={a.id}>
              <div>
                <span className="adm-pill adm-pill-info">{typeLabel[a.type] || a.type}</span>
                {a.pinned && <span className="adm-pill adm-pill-warn"><Pin size={11} /> Sabit</span>}
                <strong>{a.title}</strong>
                <small className="adm-muted">{toDate(a.created_at)?.toLocaleString('tr-TR') || '—'}</small>
              </div>
              <div className="adm-ann-actions">
                <button className="adm-icon-btn" onClick={() => setEditing(a)} aria-label="Düzenle"><Pencil size={14} /></button>
                <button className="adm-icon-btn danger" onClick={() => remove(a)} aria-label="Sil"><Trash2 size={14} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <AnnouncementForm initial={editing} me={me} onClose={() => setEditing(null)} />}
    </section>
  );
};

export default AdminAnnouncements;
