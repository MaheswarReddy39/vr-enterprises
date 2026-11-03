import { ArrowDown, ArrowUp, Image as ImageIcon, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as adminApi from '../../api/admin.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { SafeImage } from '../../components/ui/SafeImage.jsx';
import { EmptyState, ErrorState, LoadingState, Spinner } from '../../components/ui/States.jsx';
import { Switch } from '../../components/ui/Switch.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { ALLOWED_IMAGE_TYPES, checkImageFiles, fieldErrorsFromApi } from '../../lib/forms.js';
import { formatDateTime } from '../../lib/format.js';
import { moveItem } from '../../lib/reorder.js';

const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const SAFE_LINK = /^(\/(?!\/)[A-Za-z0-9\-._~/?=&#%+]*|https:\/\/\S+)$/;

export function validateBanner(form) {
  const e = {};
  if (form.title.trim().length < 2) e.title = 'Enter a title (at least 2 characters).';
  if (form.linkUrl.trim() && !SAFE_LINK.test(form.linkUrl.trim())) e.linkUrl = 'Use a site path like /shop or a full https:// address.';
  if (form.startsAt && form.endsAt && new Date(form.endsAt) < new Date(form.startsAt)) e.endsAt = 'The end must be after the start.';
  return e;
}

function BannerModal({ banner, onClose, onSaved }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [form, setForm] = useState(() => ({
    title: banner?.title ?? '', subtitle: banner?.subtitle ?? '', ctaLabel: banner?.ctaLabel ?? '', linkUrl: banner?.linkUrl ?? '',
    isActive: banner?.isActive ?? true, startsAt: toLocalInput(banner?.startsAt), endsAt: toLocalInput(banner?.endsAt),
  }));
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  const shown = preview ?? banner?.image?.thumbUrl;

  const pick = (event) => {
    const { accepted, rejected } = checkImageFiles([...event.target.files], { slotsLeft: 1 });
    event.target.value = '';
    if (rejected.length) return setErrors((e) => ({ ...e, image: rejected[0] }));
    setErrors((e) => ({ ...e, image: undefined }));
    setFile(accepted[0]);
    setPreview(URL.createObjectURL(accepted[0]));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = validateBanner(form);
    setErrors(found);
    if (Object.keys(found).length) return document.getElementById(found.title ? 'ban-title' : found.linkUrl ? 'ban-link' : 'ban-end')?.focus();

    setSaving(true);
    const body = {
      title: form.title.trim(), subtitle: form.subtitle.trim(), ctaLabel: form.ctaLabel.trim(), linkUrl: form.linkUrl.trim(),
      isActive: form.isActive, startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null, endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };
    let saved;
    try {
      saved = (banner ? await adminApi.updateBanner(banner._id, body) : await adminApi.createBanner(body)).banner;
    } catch (error) {
      setErrors({ form: error.message, ...fieldErrorsFromApi(error) });
      setSaving(false);
      return;
    }
    try {
      if (file) {
        setProgress(0);
        await adminApi.uploadBannerImage(saved._id, file, setProgress);
      }
      toast.success(banner ? 'Banner updated.' : 'Banner created.');
    } catch (error) {
      toast.error(`Banner saved, but the picture failed: ${error.message}`);
    }
    onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      title={banner ? 'Edit banner' : 'New banner'}
      size="lg"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" form="banner-form" disabled={saving}>{saving && <Spinner size={16} />} {banner ? 'Save changes' : 'Create banner'}</Button>
      </>}
    >
      <form id="banner-form" onSubmit={submit} noValidate className="space-y-4">
        {errors.form && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{errors.form}</p>}
        <Input id="ban-title" label="Title *" data-autofocus value={form.title} maxLength={80} error={errors.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Input label="Subtitle" value={form.subtitle} maxLength={200} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Button label" value={form.ctaLabel} maxLength={30} hint="For example: Shop now" onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} />
          <Input id="ban-link" label="Link" value={form.linkUrl} maxLength={300} error={errors.linkUrl} hint="A site path such as /shop?category=water, or a full https:// address." onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Show from (optional)" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          <Input id="ban-end" label="Show until (optional)" type="datetime-local" value={form.endsAt} error={errors.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
        </div>
        <Switch checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} label="Active" description="Inactive banners are hidden from the homepage." />

        <div>
          <p className="text-sm font-medium">Picture</p>
          <div className="mt-2 flex items-center gap-4">
            <div className="grid h-24 w-40 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-paper text-muted">
              {shown ? <SafeImage src={shown} alt="Banner preview" className="size-full object-cover" /> : <ImagePlus size={24} aria-hidden="true" />}
            </div>
            <div className="space-y-2">
              <input ref={fileRef} type="file" hidden accept={ALLOWED_IMAGE_TYPES.join(',')} aria-label="Choose banner picture" onChange={pick} />
              <Button variant="secondary" size="sm" onClick={() => fileRef.current.click()} disabled={saving}>{shown ? 'Replace picture' : 'Choose picture'}</Button>
              <p className="text-xs text-muted">JPEG, PNG or WebP, up to 5 MB. A wide image (about 16:9) works best. Banners without a picture are not shown.</p>
            </div>
          </div>
          {errors.image && <p role="alert" className="mt-2 text-sm text-danger">{errors.image}</p>}
          {progress !== null && <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="mt-3 h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-brand-600 transition-[width]" style={{ width: `${progress}%` }} /></div>}
        </div>
      </form>
    </Modal>
  );
}

function scheduleText(b) {
  if (b.startsAt && b.endsAt) return `${formatDateTime(b.startsAt)} to ${formatDateTime(b.endsAt)}`;
  if (b.startsAt) return `From ${formatDateTime(b.startsAt)}`;
  if (b.endsAt) return `Until ${formatDateTime(b.endsAt)}`;
  return 'Always';
}

export default function BannersPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync((signal) => adminApi.listBanners(signal), []);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const items = data?.items ?? [];

  const move = async (from, to) => {
    const next = moveItem(items, from, to);
    if (next === items) return;
    try {
      await adminApi.reorderBanners(next.map((b) => b._id));
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await adminApi.deleteBanner(toDelete._id);
      toast.success('Banner deleted.');
      setToDelete(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Homepage banners" description="Promotional banners shown at the top of the homepage, in the order below." actions={<Button onClick={() => setEditing('new')}><Plus size={18} /> New banner</Button>} />
      <Card className="p-0 sm:p-0">
        {loading && !data ? <LoadingState label="Loading banners..." /> : error ? <ErrorState message={error.message} onRetry={reload} /> : items.length === 0 ? (
          <EmptyState icon={ImageIcon} title="No banners yet" description="Add a banner with a picture to feature an offer or collection on the homepage." action={<Button onClick={() => setEditing('new')}><Plus size={18} /> New banner</Button>} />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((b, i) => (
              <li key={b._id} className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
                <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-line bg-paper">
                  {b.image ? <SafeImage src={b.image.thumbUrl} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-xs text-muted">No picture</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{b.title} <Badge tone={b.isActive ? 'success' : 'neutral'} className="ml-1">{b.isActive ? 'Active' : 'Inactive'}</Badge></p>
                  <p className="truncate text-sm text-muted">{b.linkUrl || 'No link'} · {scheduleText(b)}</p>
                  {!b.image && <p className="text-xs text-warning">Not shown until a picture is added.</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="px-2" aria-label={`Move ${b.title} up`} disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp size={16} /></Button>
                  <Button variant="ghost" size="sm" className="px-2" aria-label={`Move ${b.title} down`} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}><ArrowDown size={16} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(b)}>Edit</Button>
                  {user.role === 'admin' && <Button variant="ghost" size="sm" className="text-danger" aria-label={`Delete ${b.title}`} onClick={() => setToDelete(b)}><Trash2 size={16} /></Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && <BannerModal banner={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      <ConfirmDialog open={!!toDelete} busy={busy} title="Delete this banner?" description={`"${toDelete?.title}" and its picture will be permanently deleted.`} confirmLabel="Delete banner" onConfirm={remove} onCancel={() => setToDelete(null)} />
    </>
  );
}
