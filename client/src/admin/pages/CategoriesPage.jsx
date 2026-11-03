import { ImagePlus, Plus, Search, Tags, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as adminApi from '../../api/admin.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SafeImage } from '../../components/ui/SafeImage.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { EmptyState, ErrorState, LoadingState, Spinner } from '../../components/ui/States.jsx';
import { Switch } from '../../components/ui/Switch.jsx';
import { Table, Td, Th } from '../../components/ui/Table.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { ALLOWED_IMAGE_TYPES, checkImageFiles, fieldErrorsFromApi } from '../../lib/forms.js';
import { ActiveBadge } from '../components/StatusBadges.jsx';

const emptyForm = { name: '', description: '', parent: '', sortOrder: '0', isActive: true };

function CategoryModal({ category, allCategories, onClose, onSaved }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [form, setForm] = useState(() =>
    category
      ? { name: category.name, description: category.description ?? '', parent: category.parent ?? '', sortOrder: String(category.sortOrder), isActive: category.isActive }
      : emptyForm,
  );
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const parents = allCategories.filter((c) => !c.parent && c._id !== category?._id);
  const currentImage = !removeImage && !file ? category?.image?.thumbUrl : null;

  const pickFile = (event) => {
    const { accepted, rejected } = checkImageFiles([...event.target.files], { slotsLeft: 1 });
    event.target.value = '';
    if (rejected.length) return setErrors((e) => ({ ...e, image: rejected[0] }));
    setErrors((e) => ({ ...e, image: undefined }));
    setFile(accepted[0]);
    setPreview(URL.createObjectURL(accepted[0]));
  };

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter a category name (at least 2 characters).';
    if (!/^-?\d+$/.test(form.sortOrder.trim())) next.sortOrder = 'Enter a whole number.';
    setErrors(next);
    if (Object.keys(next).length) return document.getElementById(next.name ? 'cat-name' : 'cat-sort')?.focus();

    setSaving(true);
    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      parent: form.parent || null,
      sortOrder: Number(form.sortOrder),
      isActive: form.isActive,
    };
    let saved;
    try {
      saved = (category ? await adminApi.updateCategory(category._id, body) : await adminApi.createCategory(body)).category;
    } catch (error) {
      setErrors(fieldErrorsFromApi(error).name ? fieldErrorsFromApi(error) : { form: error.message, ...fieldErrorsFromApi(error) });
      setSaving(false);
      return;
    }

    try {
      if (file) {
        setProgress(0);
        await adminApi.uploadCategoryImage(saved._id, file, setProgress);
      } else if (removeImage && category?.image) {
        await adminApi.removeCategoryImage(saved._id);
      }
      toast.success(category ? 'Category updated.' : 'Category created.');
    } catch (error) {
      toast.error(`Category saved, but the image failed: ${error.message}`);
    }
    onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      title={category ? 'Edit category' : 'New category'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="category-form" disabled={saving}>{saving && <Spinner size={16} />} {category ? 'Save changes' : 'Create category'}</Button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} noValidate className="space-y-4">
        {errors.form && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{errors.form}</p>}
        <Input id="cat-name" label="Name *" data-autofocus value={form.name} maxLength={80} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Textarea label="Description" rows={3} maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Parent category" value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} hint="Optional. One level of nesting.">
            <option value="">None (top level)</option>
            {parents.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
          <Input id="cat-sort" label="Display order" inputMode="numeric" value={form.sortOrder} error={errors.sortOrder} hint="Lower numbers appear first." onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
        </div>
        <Switch checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} label="Active" description="Inactive categories are hidden from the storefront." />

        <div>
          <p className="text-sm font-medium">Category image</p>
          <div className="mt-2 flex items-center gap-4">
            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-paper text-muted">
              {preview || currentImage ? <SafeImage src={preview ?? currentImage} alt="Category preview" className="size-full object-cover" /> : <ImagePlus size={22} aria-hidden="true" />}
            </div>
            <div className="space-y-2">
              <input ref={fileRef} type="file" hidden accept={ALLOWED_IMAGE_TYPES.join(',')} aria-label="Choose category image" onChange={pickFile} />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => fileRef.current.click()} disabled={saving}>{preview || currentImage ? 'Replace image' : 'Choose image'}</Button>
                {(preview || currentImage) && (
                  <Button variant="ghost" size="sm" disabled={saving} onClick={() => { setFile(null); setPreview(null); setRemoveImage(true); }}>
                    <Trash2 size={14} /> Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted">JPEG, PNG or WebP, up to 5 MB.</p>
            </div>
          </div>
          {errors.image && <p role="alert" className="mt-2 text-sm text-danger">{errors.image}</p>}
          {progress !== null && (
            <div className="mt-3" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-brand-600 transition-[width]" style={{ width: `${progress}%` }} /></div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default function CategoriesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search);
  const [editing, setEditing] = useState(null); // null | 'new' | category
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setPage(1), [q]);
  const { data, loading, error, reload } = useAsync((signal) => adminApi.listCategories({ page, limit: 15, q }, signal), [page, q]);
  const all = useAsync((signal) => adminApi.listCategories({ limit: 100 }, signal), []);

  const remove = async () => {
    setBusy(true);
    try {
      await adminApi.deleteCategory(toDelete._id);
      toast.success('Category deleted.');
      setToDelete(null);
      reload();
      all.reload();
    } catch (err) {
      toast.error(err.message);
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id) => all.data?.items.find((c) => c._id === id)?.name;
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="Categories" description="Organise your catalogue. Categories can be added, renamed, hidden or removed at any time." actions={<Button onClick={() => setEditing('new')}><Plus size={18} /> New category</Button>} />
      <Card className="p-0 sm:p-0">
        <div className="relative max-w-sm p-4">
          <Search size={16} className="pointer-events-none absolute left-7 top-[3.45rem] text-muted" aria-hidden="true" />
          <Input label="Search" type="search" placeholder="Category name" className="[&_input]:pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loading && !data ? <LoadingState label="Loading categories..." /> : error ? <ErrorState message={error.message} onRetry={reload} /> : items.length === 0 ? (
          q ? <EmptyState icon={Search} title="No categories match your search" /> : <EmptyState icon={Tags} title="No categories yet" description="Create a category before adding products." action={<Button onClick={() => setEditing('new')}><Plus size={18} /> New category</Button>} />
        ) : (
          <>
            <Table caption="Categories">
              <thead><tr><Th>Category</Th><Th className="hidden sm:table-cell">Parent</Th><Th>Products</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c._id} className="hover:bg-paper/50">
                    <Td>
                      <div className="flex items-center gap-3">
                        {c.image ? <SafeImage src={c.image.thumbUrl} alt="" className="size-10 rounded-lg border border-line object-cover" /> : <span className="grid size-10 place-items-center rounded-lg border border-dashed border-line text-muted"><Tags size={16} aria-hidden="true" /></span>}
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </Td>
                    <Td className="hidden sm:table-cell">{c.parent ? (nameOf(c.parent) ?? '-') : '-'}</Td>
                    <Td>{c.productCount}</Td>
                    <Td><ActiveBadge active={c.isActive} /></Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>Edit</Button>
                        {user.role === 'admin' && <Button variant="ghost" size="sm" className="text-danger" onClick={() => setToDelete(c)}>Delete</Button>}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination pagination={data.pagination} onChange={setPage} />
          </>
        )}
      </Card>

      {editing && (
        <CategoryModal
          category={editing === 'new' ? null : editing}
          allCategories={all.data?.items ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); all.reload(); }}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        busy={busy}
        title="Delete this category?"
        description={toDelete?.productCount > 0 ? `"${toDelete?.name}" still has ${toDelete?.productCount} product(s) and cannot be deleted. Mark it inactive instead, or move its products first.` : `"${toDelete?.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete category"
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
