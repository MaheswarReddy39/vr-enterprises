import { Plus, Search, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as adminApi from '../../api/admin.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { EmptyState, ErrorState, LoadingState, Spinner } from '../../components/ui/States.jsx';
import { Switch } from '../../components/ui/Switch.jsx';
import { Table, Td, Th } from '../../components/ui/Table.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { fieldErrorsFromApi } from '../../lib/forms.js';
import { ActiveBadge } from '../components/StatusBadges.jsx';

function BrandModal({ brand, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: brand?.name ?? '', description: brand?.description ?? '', isActive: brand?.isActive ?? true });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (form.name.trim().length < 2) {
      setErrors({ name: 'Enter a brand name (at least 2 characters).' });
      return document.getElementById('brand-name')?.focus();
    }
    setSaving(true);
    const body = { name: form.name.trim(), description: form.description.trim(), isActive: form.isActive };
    try {
      await (brand ? adminApi.updateBrand(brand._id, body) : adminApi.createBrand(body));
      toast.success(brand ? 'Brand updated.' : 'Brand created.');
      onSaved();
    } catch (error) {
      setErrors({ form: error.message, ...fieldErrorsFromApi(error) });
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      title={brand ? 'Edit brand' : 'New brand'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="brand-form" disabled={saving}>{saving && <Spinner size={16} />} {brand ? 'Save changes' : 'Create brand'}</Button>
        </>
      }
    >
      <form id="brand-form" onSubmit={submit} noValidate className="space-y-4">
        {errors.form && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{errors.form}</p>}
        <Input id="brand-name" label="Name *" data-autofocus value={form.name} maxLength={80} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Textarea label="Description" rows={3} maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Switch checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} label="Active" description="Inactive brands are hidden from the storefront." />
      </form>
    </Modal>
  );
}

export default function BrandsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search);
  const [editing, setEditing] = useState(null);

  useEffect(() => setPage(1), [q]);
  const { data, loading, error, reload } = useAsync((signal) => adminApi.listBrands({ page, limit: 15, q }, signal), [page, q]);
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="Brands" description="Brands you sell. Mark a brand inactive to hide it without losing its products." actions={<Button onClick={() => setEditing('new')}><Plus size={18} /> New brand</Button>} />
      <Card className="p-0 sm:p-0">
        <div className="relative max-w-sm p-4">
          <Search size={16} className="pointer-events-none absolute left-7 top-[3.45rem] text-muted" aria-hidden="true" />
          <Input label="Search" type="search" placeholder="Brand name" className="[&_input]:pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loading && !data ? <LoadingState label="Loading brands..." /> : error ? <ErrorState message={error.message} onRetry={reload} /> : items.length === 0 ? (
          q ? <EmptyState icon={Search} title="No brands match your search" /> : <EmptyState icon={Tag} title="No brands yet" description="Brands are optional. Add one if you want to group products by brand." action={<Button onClick={() => setEditing('new')}><Plus size={18} /> New brand</Button>} />
        ) : (
          <>
            <Table caption="Brands">
              <thead><tr><Th>Brand</Th><Th>Products</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b._id} className="hover:bg-paper/50">
                    <Td><span className="font-medium">{b.name}</span>{b.description && <p className="line-clamp-1 text-xs text-muted">{b.description}</p>}</Td>
                    <Td>{b.productCount}</Td>
                    <Td><ActiveBadge active={b.isActive} /></Td>
                    <Td><div className="flex justify-end"><Button variant="ghost" size="sm" onClick={() => setEditing(b)}>Edit</Button></div></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination pagination={data.pagination} onChange={setPage} />
          </>
        )}
      </Card>
      {editing && <BrandModal brand={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}
