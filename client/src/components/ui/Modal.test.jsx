import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { ToastProvider, useToast } from './Toast.jsx';

describe('ConfirmDialog', () => {
  const setup = (props = {}) => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Delete it?" description="Gone forever." onConfirm={onConfirm} onCancel={onCancel} {...props} />);
    return { onConfirm, onCancel };
  };

  it('is an accessible modal dialog labelled by its title, focused on Cancel (the safe choice)', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Delete it?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('confirms and cancels via buttons and Escape', async () => {
    const { onConfirm, onCancel } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps focus inside the dialog when tabbing', async () => {
    setup();
    for (let i = 0; i < 6; i += 1) {
      await userEvent.tab();
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    }
  });

  it('cannot be dismissed or double-submitted while busy', async () => {
    const { onConfirm, onCancel } = setup({ busy: true });
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    setup({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Toast', () => {
  function Trigger() {
    const toast = useToast();
    const [n, setN] = useState(0);
    return (
      <>
        <button onClick={() => toast.success(`Saved ${n}`)}>ok</button>
        <button onClick={() => { setN(n + 1); toast.error('Boom'); }}>fail</button>
      </>
    );
  }

  it('announces success politely and errors as alerts, and can be dismissed', async () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    await userEvent.click(screen.getByText('ok'));
    expect(screen.getByRole('status')).toHaveTextContent('Saved 0');
    await userEvent.click(screen.getByText('fail'));
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
    await userEvent.click(screen.getAllByRole('button', { name: 'Dismiss notification' })[0]);
    expect(screen.queryByText('Saved 0')).not.toBeInTheDocument();
  });
});
