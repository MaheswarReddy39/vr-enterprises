import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SpecificationEditor, fromEditorSpecs, toEditorSpecs } from './SpecificationEditor.jsx';

function Harness({ initial = [] }) {
  const [value, setValue] = useState(toEditorSpecs(initial));
  return (
    <>
      <SpecificationEditor value={value} onChange={setValue} />
      <output data-testid="api">{JSON.stringify(fromEditorSpecs(value))}</output>
    </>
  );
}
const api = () => JSON.parse(screen.getByTestId('api').textContent);

describe('SpecificationEditor', () => {
  it('starts empty and lets the admin build any groups and fields', async () => {
    render(<Harness />);
    expect(screen.getByText(/No specifications yet/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /add specification group/i }));
    await userEvent.type(screen.getByLabelText('Group name (optional)'), 'My group');
    await userEvent.type(screen.getByLabelText('Field name, group 1 row 1'), 'Anything I like');
    await userEvent.type(screen.getByLabelText('Field value, group 1 row 1'), '42 units');
    await userEvent.click(screen.getByRole('button', { name: /add field/i }));
    await userEvent.type(screen.getByLabelText('Field name, group 1 row 2'), 'Another');
    await userEvent.type(screen.getByLabelText('Field value, group 1 row 2'), 'Value');

    expect(api()).toEqual([{ group: 'My group', items: [{ label: 'Anything I like', value: '42 units' }, { label: 'Another', value: 'Value' }] }]);
  });

  it('loads existing specifications and removes fields and groups', async () => {
    render(<Harness initial={[{ group: 'A', items: [{ label: 'x', value: '1' }, { label: 'y', value: '2' }] }, { group: 'B', items: [{ label: 'z', value: '3' }] }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove field x' }));
    expect(api()[0].items).toEqual([{ label: 'y', value: '2' }]);
    await userEvent.click(screen.getByRole('button', { name: 'Remove group B' }));
    expect(api()).toHaveLength(1);
  });

  it('keeps the last field of a group (remove the group instead)', () => {
    render(<Harness initial={[{ group: 'A', items: [{ label: 'x', value: '1' }] }]} />);
    expect(screen.getByRole('button', { name: 'Remove field x' })).toBeDisabled();
  });

  it('drops rows and groups the admin left blank when saving', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /add specification group/i }));
    expect(api()).toEqual([]);
  });

  it('suggests example labels without forcing them', () => {
    const { container } = render(<Harness initial={[{ group: '', items: [{ label: 'x', value: '1' }] }]} />);
    const options = [...container.querySelectorAll('datalist option')].map((o) => o.value);
    expect(options).toContain('Warranty');
    expect(screen.getByLabelText('Field name, group 1 row 1')).toHaveValue('x');
  });
});
