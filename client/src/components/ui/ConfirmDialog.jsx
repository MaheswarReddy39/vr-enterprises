import { Button } from './Button.jsx';
import { Modal } from './Modal.jsx';
import { Spinner } from './States.jsx';

/** Confirmation for destructive actions. `onConfirm` may be async; the dialog stays open and busy until it settles. */
export function ConfirmDialog({ open, title, description, confirmLabel = 'Delete', busy = false, onConfirm, onCancel, tone = 'danger' }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy} data-autofocus>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} disabled={busy}>
            {busy && <Spinner size={16} />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted">{description}</p>
    </Modal>
  );
}
