// Admin → Ana sayfa vitrini: çerçevedeki görsel/video ve süzülen öğeler (settings/hero).
import React, { useEffect, useRef, useState } from 'react';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Upload } from 'lucide-react';
import { db } from '../../lib/firebase';
import { loggedWrite } from '../../lib/adminLog';
import { fileToCompressedDataUrl } from './imageUtils';
import { resolveHero } from '../../lib/heroMedia';

const EMPTY = { mode: 'auto', image_url: '', video_url: '', show_cards: true, show_boxes: true };
const MODES = [
  ['auto', 'Otomatik (ürün ekran görüntüsü / varsayılan video)'],
  ['image', 'Kendi görselim'],
  ['video', 'Kendi videom'],
];

const AdminHero = ({ me }) => {
  const [h, setH] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'hero')).then((s) => setH({ ...EMPTY, ...(s.exists() ? s.data() : {}) }));
  }, []);

  if (!h) return <p className="adm-muted">Yükleniyor…</p>;
  const set = (k) => (e) => setH((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const preview = resolveHero(h, '');
  const urlOnly = h.image_url.startsWith('data:') ? '' : h.image_url;

  const onFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await fileToCompressedDataUrl(file, 1600);
      setH((x) => ({ ...x, image_url: url }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (h.mode === 'image' && !h.image_url) return toast.error('Önce bir görsel yükle ya da URL gir.');
    if (h.mode === 'video' && !/^https?:\/\//i.test(h.video_url.trim())) return toast.error('Video için https:// ile başlayan bir bağlantı gir (.mp4 / .webm ya da YouTube).');
    setSaving(true);
    try {
      const data = { mode: h.mode, image_url: h.image_url || '', video_url: h.video_url.trim(), show_cards: !!h.show_cards, show_boxes: !!h.show_boxes, updated_at: serverTimestamp() };
      const label = MODES.find((m) => m[0] === data.mode)?.[1].split(' (')[0];
      await loggedWrite({ me, mode: 'set', collectionName: 'settings', id: 'hero', targetType: 'settings', action: 'update', data, summary: `Ana sayfa vitrini: ${label}` });
      toast.success('Vitrin kaydedildi');
    } catch (err) {
      toast.error(err.code || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="adm-card adm-card-pad" onSubmit={save}>
      <h2 className="adm-card-title">Ana sayfa vitrini</h2>
      <p className="adm-muted adm-help">Ana sayfadaki büyük çerçevede görünen içerik. Kaydedince sitede değişir.</p>

      <label className="adm-field">
        <span className="adm-label">Çerçevede ne gösterilsin</span>
        <select className="adm-input" value={h.mode} onChange={set('mode')}>
          {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>

      {h.mode === 'image' && (
        <div className="adm-field">
          <span className="adm-label">Görsel</span>
          <div className="adm-image-field">
            <div className="adm-image-preview">{h.image_url ? <img src={h.image_url} alt="" /> : <span>Görsel yok</span>}</div>
            <div className="adm-image-actions">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
              <button type="button" className="adm-btn adm-btn-ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Upload size={13} /> {busy ? 'İşleniyor…' : 'Dosya yükle'}
              </button>
              <input className="adm-input" placeholder="ya da görsel URL’si https://…" value={urlOnly} onChange={(e) => setH((x) => ({ ...x, image_url: e.target.value.trim() }))} />
              <small className="adm-muted">16:9 oran en iyisi. Yüklenen görsel otomatik küçültülür.</small>
            </div>
          </div>
        </div>
      )}

      {h.mode === 'video' && (
        <>
          <label className="adm-field">
            <span className="adm-label">Video bağlantısı</span>
            <input className="adm-input" value={h.video_url} onChange={set('video_url')} placeholder="https://…/video.mp4  veya  YouTube linki" />
            <span className="adm-muted adm-help">Sessiz, otomatik ve döngüde oynar. Dosya veritabanına sığmadığı için bağlantı gerekir: doğrudan .mp4/.webm adresi ya da YouTube.</span>
          </label>
          <label className="adm-field">
            <span className="adm-label">Kapak görseli (video yüklenene kadar, opsiyonel)</span>
            <input className="adm-input" value={urlOnly} onChange={(e) => setH((x) => ({ ...x, image_url: e.target.value.trim() }))} placeholder="https://…" />
          </label>
        </>
      )}

      <div className="adm-grid-2">
        <label className="adm-switch"><input type="checkbox" checked={h.show_cards} onChange={set('show_cards')} /><span className="adm-switch-track"><span /></span>Süzülen özellik kartlarını göster</label>
        <label className="adm-switch"><input type="checkbox" checked={h.show_boxes} onChange={set('show_boxes')} /><span className="adm-switch-track"><span /></span>Köşelerdeki 3D ürün kutularını göster</label>
      </div>

      {h.mode !== 'auto' && preview.kind !== 'auto' && (
        <div className="adm-promo-preview">
          {preview.kind === 'image' && <img src={preview.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          {preview.kind === 'video' && <video src={preview.url} poster={preview.poster || undefined} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          {preview.kind === 'embed' && <iframe src={preview.url} title="Önizleme" allow="autoplay" style={{ width: '100%', height: '100%', border: 0 }} />}
        </div>
      )}

      <div className="adm-form-actions"><button className="adm-btn adm-btn-primary" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button></div>
    </form>
  );
};

export default AdminHero;
