import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as adminApi from '../../api/admin.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { SafeImage } from '../../components/ui/SafeImage.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { cn } from '../../lib/cn.js';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGES, checkImageFiles } from '../../lib/forms.js';
import { moveItem } from '../../lib/reorder.js';

/**
 * Product image gallery: multi-file upload with previews and progress, drag-and-drop reordering (with
 * keyboard-accessible move buttons), primary selection and confirmed deletion.
 */
export function ImageManager({ productId, images, onProductChange }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [pending, setPending] = useState([]); // [{ file, preview }]
  const [progress, setProgress] = useState(null); // null | 0-100
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [dropActive, setDropActive] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [problems, setProblems] = useState([]);

  const uploading = progress !== null;
  const slotsLeft = MAX_IMAGES - images.length;

  useEffect(() => () => pending.forEach((p) => URL.revokeObjectURL(p.preview)), [pending]);

  const stage = (fileList) => {
    const { accepted, rejected } = checkImageFiles([...fileList], { slotsLeft: slotsLeft - pending.length });
    setProblems(rejected);
    if (accepted.length) setPending((list) => [...list, ...accepted.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const upload = async () => {
    setProgress(0);
    try {
      const { product } = await adminApi.uploadProductImages(productId, pending.map((p) => p.file), setProgress);
      onProductChange(product);
      toast.success(`${pending.length} image${pending.length > 1 ? 's' : ''} uploaded.`);
      setPending([]);
      setProblems([]);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setProgress(null);
    }
  };

  const reorder = async (from, to) => {
    const next = moveItem(images, from, to);
    if (next === images) return;
    const previous = images;
    onProductChange({ images: next }, { merge: true }); // optimistic
    setAnnouncement(`Image moved to position ${to + 1} of ${images.length}.`);
    try {
      const { product } = await adminApi.reorderProductImages(productId, next.map((i) => i._id));
      onProductChange(product);
    } catch (error) {
      onProductChange({ images: previous }, { merge: true });
      toast.error(`Could not save the new order: ${error.message}`);
    }
  };

  const makePrimary = async (image) => {
    setBusyId(image._id);
    try {
      onProductChange((await adminApi.setPrimaryImage(productId, image._id)).product);
      toast.success('Primary image updated.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    setBusyId(toDelete._id);
    try {
      onProductChange((await adminApi.deleteProductImage(productId, toDelete._id)).product);
      toast.success('Image deleted.');
      setToDelete(null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const onDropFiles = (event) => {
    event.preventDefault();
    setDropActive(false);
    if (slotsLeft - pending.length > 0 && !uploading) stage(event.dataTransfer.files);
  };

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDropActive(true);
          }
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={onDropFiles}
        className={cn(
          'flex flex-col items-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
          dropActive ? 'border-brand-500 bg-brand-50' : 'border-line bg-paper/60',
        )}
      >
        <UploadCloud size={28} className="text-brand-600" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium">Drag and drop images here</p>
        <p className="mt-1 text-xs text-muted">JPEG, PNG or WebP, up to 5 MB each. {slotsLeft} of {MAX_IMAGES} slots free.</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          aria-label="Choose product images"
          onChange={(e) => {
            stage(e.target.files);
            e.target.value = '';
          }}
        />
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => inputRef.current.click()} disabled={uploading || slotsLeft - pending.length <= 0}>
          <ImagePlus size={16} /> Choose images
        </Button>
      </div>

      {problems.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {/* Staged files with previews */}
      {pending.length > 0 && (
        <div className="space-y-3 rounded-lg border border-line p-4">
          <p className="text-sm font-medium">Ready to upload ({pending.length})</p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {pending.map(({ file, preview }) => (
              <li key={preview} className="relative aspect-square overflow-hidden rounded-xl border border-line/80 bg-paper">
                <img src={preview} alt={`Preview of ${file.name}`} className="size-full object-cover" />
                {!uploading && (
                  <button
                    type="button"
                    aria-label={`Remove ${file.name} from the upload`}
                    onClick={() => setPending((list) => list.filter((p) => p.preview !== preview))}
                    className="absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-white hover:bg-ink"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {uploading && (
            <div>
              <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{progress < 100 ? `Uploading... ${progress}%` : 'Processing...'}</p>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={upload} disabled={uploading}>
              Upload {pending.length} image{pending.length > 1 ? 's' : ''}
            </Button>
            <Button variant="ghost" onClick={() => setPending([])} disabled={uploading}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Saved images */}
      {images.length === 0 ? (
        <p className="text-center text-sm text-muted">No images yet. A product needs at least one image to be published.</p>
      ) : (
        <>
          <p className="text-xs text-muted">Drag images to reorder, or use the arrow buttons. The primary image is used on product cards.</p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image, index) => (
              <li
                key={image._id}
                draggable={!busyId}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => {
                  if (dragIndex !== null) {
                    e.preventDefault();
                    setOverIndex(index);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null) reorder(dragIndex, index);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={cn(
                  'group overflow-hidden rounded-lg border bg-ivory shadow-soft transition',
                  dragIndex === index && 'opacity-40',
                  overIndex === index && dragIndex !== index ? 'border-brand-500 ring-2 ring-brand-300' : 'border-line',
                )}
              >
                <div className="relative aspect-square cursor-grab bg-paper active:cursor-grabbing">
                  <SafeImage src={image.thumbUrl ?? image.url} alt={image.alt || `Product image ${index + 1}`} draggable={false} className="size-full object-cover" />
                  <span className="absolute left-2 top-2 rounded bg-ink/70 px-1.5 py-0.5 text-xs text-white">{index + 1}</span>
                  {image.isPrimary && (
                    <Badge tone="accent" className="absolute right-2 top-2 shadow-sm">
                      Primary
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-1 p-2">
                  <div className="flex">
                    <Button variant="ghost" size="sm" className="px-2" aria-label={`Move image ${index + 1} earlier`} disabled={index === 0 || !!busyId} onClick={() => reorder(index, index - 1)}>
                      <ArrowLeft size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" className="px-2" aria-label={`Move image ${index + 1} later`} disabled={index === images.length - 1 || !!busyId} onClick={() => reorder(index, index + 1)}>
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                  <div className="flex">
                    <Button variant="ghost" size="sm" className="px-2" aria-label={`Make image ${index + 1} the primary image`} disabled={image.isPrimary || !!busyId} onClick={() => makePrimary(image)}>
                      <Star size={16} className={image.isPrimary ? 'fill-accent-400 text-accent-500' : ''} />
                    </Button>
                    <Button variant="ghost" size="sm" className="px-2 text-danger" aria-label={`Delete image ${index + 1}`} disabled={!!busyId} onClick={() => setToDelete(image)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this image?"
        description="The image is removed from this product and from image storage. This cannot be undone."
        busy={!!busyId}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
