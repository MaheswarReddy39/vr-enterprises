import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as adminApi from '../../api/admin.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { ErrorState, LoadingState, Spinner } from '../../components/ui/States.jsx';
import { Switch } from '../../components/ui/Switch.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { fieldErrorsFromApi } from '../../lib/forms.js';
import { formatNumber } from '../../lib/format.js';
import { ImageManager } from '../components/ImageManager.jsx';
import { ProductStatusBadge } from '../components/StatusBadges.jsx';
import { SpecificationEditor, fromEditorSpecs, toEditorSpecs } from '../components/SpecificationEditor.jsx';

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,38}[A-Z0-9]$/;
const hasMoreThan2Decimals = (text) => /\.\d{3,}/.test(text);
let featureKey = 0;

const blank = {
  name: '', sku: '', category: '', brand: '', shortDescription: '', description: '',
  price: '', mrp: '', stock: '0', lowStockThreshold: '5', status: 'draft', isFeatured: false,
  features: [], specs: [],
};

const fromProduct = (p) => ({
  name: p.name, sku: p.sku, category: p.category?._id ?? '', brand: p.brand?._id ?? '',
  shortDescription: p.shortDescription ?? '', description: p.description ?? '',
  price: String(p.price), mrp: p.mrp == null ? '' : String(p.mrp), stock: String(p.stock),
  lowStockThreshold: String(p.lowStockThreshold), status: p.status, isFeatured: p.isFeatured,
  features: p.features.map((text) => ({ key: `f${featureKey++}`, text })), specs: toEditorSpecs(p.specifications),
});

/** Client-side checks that mirror the server rules, so mistakes are caught before a round trip. The server re-validates everything. */
export function validateProduct(v, { isNew }) {
  const e = {};
  if (v.name.trim().length < 2) e.name = 'Enter a product name (at least 2 characters).';
  if (v.sku.trim() && !SKU_PATTERN.test(v.sku.trim().toUpperCase())) e.sku = 'Use 3-40 letters, numbers or hyphens, or leave blank to generate one.';
  if (!v.category) e.category = 'Choose a category.';

  const price = Number(v.price);
  if (v.price.trim() === '' || Number.isNaN(price)) e.price = 'Enter the selling price.';
  else if (price < 0) e.price = 'Price cannot be negative.';
  else if (hasMoreThan2Decimals(v.price)) e.price = 'Use at most 2 decimal places.';

  if (v.mrp.trim() !== '') {
    const mrp = Number(v.mrp);
    if (Number.isNaN(mrp) || mrp < 0) e.mrp = 'Enter a valid MRP.';
    else if (hasMoreThan2Decimals(v.mrp)) e.mrp = 'Use at most 2 decimal places.';
    else if (!e.price && mrp < price) e.mrp = 'MRP cannot be lower than the selling price.';
  }
  if (isNew && !/^\d+$/.test(v.stock.trim() || '0')) e.stock = 'Enter a whole number (0 or more).';
  if (!/^\d+$/.test(v.lowStockThreshold.trim())) e.lowStockThreshold = 'Enter a whole number (0 or more).';

  v.specs.forEach((group, gi) => {
    const seen = new Set();
    group.items.forEach((item, ii) => {
      const label = item.label.trim();
      const value = item.value.trim();
      if (!label && !value) return;
      if (!label) e[`specifications.${gi}.items.${ii}.label`] = 'Enter a field name.';
      else if (seen.has(label.toLowerCase())) e[`specifications.${gi}.items.${ii}.label`] = 'This field name is already used in the group.';
      if (!value) e[`specifications.${gi}.items.${ii}.value`] = 'Enter a value.';
      seen.add(label.toLowerCase());
    });
  });
  return e;
}

const FIELD_IDS = { name: 'pf-name', sku: 'pf-sku', category: 'pf-category', price: 'pf-price', mrp: 'pf-mrp', stock: 'pf-stock', lowStockThreshold: 'pf-threshold' };
const FIELD_LABELS = { name: 'Name', sku: 'SKU', category: 'Category', price: 'Price', mrp: 'MRP', stock: 'Opening stock', lowStockThreshold: 'Low-stock alert level', status: 'Status' };

function buildPayload(v, isNew) {
  const payload = {
    name: v.name.trim(),
    category: v.category,
    brand: v.brand || null,
    shortDescription: v.shortDescription.trim(),
    description: v.description.trim(),
    price: Number(v.price),
    mrp: v.mrp.trim() === '' ? null : Number(v.mrp),
    lowStockThreshold: Number(v.lowStockThreshold),
    status: v.status,
    isFeatured: v.isFeatured,
    features: v.features.map((f) => f.text.trim()).filter(Boolean),
    specifications: fromEditorSpecs(v.specs),
  };
  if (v.sku.trim()) payload.sku = v.sku.trim();
  if (isNew) payload.stock = Number(v.stock.trim() || 0);
  return payload;
}

function Section({ title, description, children }) {
  return (
    <Card>
      <h3 className="text-xl">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </Card>
  );
}

export default function ProductFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const summaryRef = useRef(null);

  const [values, setValues] = useState(blank);
  const [product, setProduct] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const categories = useAsync((signal) => adminApi.listCategories({ limit: 100 }, signal), []);
  const brands = useAsync((signal) => adminApi.listBrands({ limit: 100 }, signal), []);
  const loaded = useAsync(
    async (signal) => {
      if (isNew) return null;
      const { product: p } = await adminApi.getProduct(id, signal);
      setProduct(p);
      setValues(fromProduct(p));
      return p;
    },
    [id],
  );

  useEffect(() => {
    if (isNew) {
      setValues(blank);
      setProduct(null);
      setErrors({});
    }
  }, [isNew]);

  const set = (patch) => setValues((v) => ({ ...v, ...patch }));
  const errorList = Object.entries(errors);

  const showErrors = (next) => {
    setErrors(next);
    requestAnimationFrame(() => {
      summaryRef.current?.focus();
      const first = Object.keys(next).find((k) => FIELD_IDS[k]);
      if (first) document.getElementById(FIELD_IDS[first])?.focus();
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = validateProduct(values, { isNew });
    if (Object.keys(found).length) return showErrors(found);

    setSaving(true);
    setErrors({});
    try {
      if (isNew) {
        const { product: created } = await adminApi.createProduct(buildPayload(values, true));
        toast.success('Product saved as a draft. Now add its images.');
        navigate(`/admin/products/${created._id}/edit`, { replace: true });
      } else {
        const { product: updated } = await adminApi.updateProduct(id, buildPayload(values, false));
        setProduct(updated);
        setValues(fromProduct(updated));
        toast.success('Product updated.');
      }
    } catch (error) {
      const mapped = fieldErrorsFromApi(error);
      showErrors(Object.keys(mapped).length ? mapped : { form: error.message });
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && loaded.loading && !product) return <LoadingState label="Loading product..." />;
  if (!isNew && loaded.error) return <ErrorState message={loaded.error.message} onRetry={loaded.reload} />;

  const updateProductState = (update, opts) => setProduct((p) => (opts?.merge ? { ...p, ...update } : update));

  return (
    <form onSubmit={submit} noValidate>
      <div className="mb-6">
        <Link to="/admin/products" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={16} /> Back to products
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl sm:text-3xl">{isNew ? 'New product' : (product?.name ?? 'Edit product')}</h2>
          {product && <ProductStatusBadge status={product.status} />}
        </div>
      </div>

      {errorList.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-6 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <p className="font-medium">Please fix {errorList.length === 1 ? 'this problem' : `these ${errorList.length} problems`} before saving:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errorList.map(([key, message]) => (
              <li key={key}>{FIELD_LABELS[key] ? `${FIELD_LABELS[key]}: ` : ''}{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Section title="Basic information">
            <Input id="pf-name" label="Product name *" value={values.name} maxLength={200} error={errors.name} onChange={(e) => set({ name: e.target.value })} />
            <Input id="pf-sku" label="SKU" placeholder="Leave blank to generate automatically" value={values.sku} maxLength={40} error={errors.sku} hint="Letters, numbers and hyphens. Must be unique." onChange={(e) => set({ sku: e.target.value })} />
            <Textarea label="Short description" rows={2} maxLength={300} value={values.shortDescription} hint={`${values.shortDescription.length}/300`} onChange={(e) => set({ shortDescription: e.target.value })} />
            <Textarea label="Full description" rows={7} maxLength={10000} value={values.description} onChange={(e) => set({ description: e.target.value })} />
          </Section>

          <Section title="Pricing">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="pf-price" label="Selling price (INR) *" inputMode="decimal" value={values.price} error={errors.price} onChange={(e) => set({ price: e.target.value })} />
              <Input id="pf-mrp" label="MRP (optional)" inputMode="decimal" value={values.mrp} error={errors.mrp} hint="Printed maximum retail price." onChange={(e) => set({ mrp: e.target.value })} />
            </div>
          </Section>

          <Section title="Specifications" description="Add any specification groups and fields you want customers to see. Everything here is optional and entirely yours to define.">
            <SpecificationEditor value={values.specs} onChange={(specs) => set({ specs })} errors={errors} />
          </Section>

          <Section title="Key features" description="Short highlights shown as a list on the product page.">
            {values.features.map((feature, i) => (
              <div key={feature.key} className="flex items-center gap-2">
                <Input aria-label={`Feature ${i + 1}`} className="flex-1" maxLength={200} value={feature.text} onChange={(e) => set({ features: values.features.map((f) => (f.key === feature.key ? { ...f, text: e.target.value } : f)) })} />
                <Button variant="ghost" size="sm" aria-label={`Remove feature ${i + 1}`} onClick={() => set({ features: values.features.filter((f) => f.key !== feature.key) })}>
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" disabled={values.features.length >= 20} onClick={() => set({ features: [...values.features, { key: `f${featureKey++}`, text: '' }] })}>
              <Plus size={16} /> Add feature
            </Button>
          </Section>

          <Section title="Images" description="The first upload becomes the primary image. You can change it at any time.">
            {isNew ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                Save the product first, then you can upload images on this page.
              </p>
            ) : (
              <ImageManager productId={id} images={product?.images ?? []} onProductChange={updateProductState} />
            )}
          </Section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Section title="Publishing">
            <Select id="pf-status" label="Status" value={values.status} onChange={(e) => set({ status: e.target.value })} hint="Publishing needs at least one image.">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
            <Switch checked={values.isFeatured} onChange={(isFeatured) => set({ isFeatured })} label="Featured product" description="Highlight on the storefront." />
          </Section>

          <Section title="Organisation">
            <Select id="pf-category" label="Category *" value={values.category} error={errors.category} onChange={(e) => set({ category: e.target.value })}>
              <option value="">Select a category</option>
              {categories.data?.items.map((c) => (
                <option key={c._id} value={c._id}>{c.parent ? '- ' : ''}{c.name}{c.isActive ? '' : ' (inactive)'}</option>
              ))}
            </Select>
            {categories.data?.items.length === 0 && (
              <p className="text-sm text-muted">No categories yet. <Link to="/admin/categories" className="text-brand-700 underline">Create one first.</Link></p>
            )}
            <Select label="Brand" value={values.brand} onChange={(e) => set({ brand: e.target.value })}>
              <option value="">No brand</option>
              {brands.data?.items.map((b) => (
                <option key={b._id} value={b._id}>{b.name}{b.isActive ? '' : ' (inactive)'}</option>
              ))}
            </Select>
          </Section>

          <Section title="Inventory">
            {isNew ? (
              <Input id="pf-stock" label="Opening stock" inputMode="numeric" value={values.stock} error={errors.stock} onChange={(e) => set({ stock: e.target.value })} />
            ) : (
              <p className="text-sm">
                In stock: <strong>{formatNumber(product?.stock)}</strong>
                <span className="mt-1 block text-muted">Change stock from the <Link to="/admin/inventory" className="text-brand-700 underline">Inventory</Link> page so every change is recorded.</span>
              </p>
            )}
            <Input id="pf-threshold" label="Low-stock alert level" inputMode="numeric" value={values.lowStockThreshold} error={errors.lowStockThreshold} hint="Alert when stock falls to this number or below." onChange={(e) => set({ lowStockThreshold: e.target.value })} />
          </Section>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving && <Spinner size={16} />} {isNew ? 'Create product' : 'Save changes'}
            </Button>
          </div>
        </aside>
      </div>
    </form>
  );
}
