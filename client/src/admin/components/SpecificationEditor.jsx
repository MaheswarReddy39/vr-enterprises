import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';

let counter = 0;
const uid = () => `k${(counter += 1)}`;

export const emptyItem = () => ({ key: uid(), label: '', value: '' });
export const emptyGroup = () => ({ key: uid(), group: '', items: [emptyItem()] });

/** API shape -> editor shape (adds local React keys). */
export const toEditorSpecs = (specs = []) =>
  specs.map((g) => ({ key: uid(), group: g.group ?? '', items: g.items.map((i) => ({ key: uid(), label: i.label, value: i.value })) }));

/** Editor shape -> API shape. Rows the admin left completely blank are dropped. */
export const fromEditorSpecs = (groups) =>
  groups
    .map((g) => ({
      group: g.group.trim(),
      items: g.items.filter((i) => i.label.trim() || i.value.trim()).map((i) => ({ label: i.label.trim(), value: i.value.trim() })),
    }))
    .filter((g) => g.items.length > 0);

// Offered only as autocomplete hints in the label box. The admin can type anything.
const LABEL_EXAMPLES = ['Technology', 'Purification stages', 'Capacity', 'Filter type', 'Warranty', 'Dimensions'];

/**
 * Fully admin-controlled specification editor: any number of groups, each with any number of
 * label/value rows. Nothing is predefined or mandatory.
 */
export function SpecificationEditor({ value, onChange, errors = {} }) {
  const listId = useId();

  const updateGroup = (gi, patch) => onChange(value.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const updateItem = (gi, ii, patch) =>
    updateGroup(gi, { items: value[gi].items.map((item, i) => (i === ii ? { ...item, ...patch } : item)) });

  return (
    <div className="space-y-4">
      <datalist id={listId}>
        {LABEL_EXAMPLES.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>

      {value.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          No specifications yet. Add a group, then add any fields you need (for example Capacity, Warranty or Dimensions).
        </p>
      )}

      {value.map((group, gi) => (
        <fieldset key={group.key} className="rounded-lg border border-line bg-paper/60 p-4">
          <legend className="sr-only">Specification group {gi + 1}</legend>
          <div className="flex items-end gap-3">
            <Input
              label="Group name (optional)"
              placeholder="e.g. Technology"
              value={group.group}
              maxLength={80}
              onChange={(e) => updateGroup(gi, { group: e.target.value })}
              className="flex-1"
            />
            <Button variant="ghost" size="sm" aria-label={`Remove group ${group.group || gi + 1}`} onClick={() => onChange(value.filter((_, i) => i !== gi))}>
              <Trash2 size={16} /> <span className="hidden sm:inline">Remove group</span>
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {group.items.map((item, ii) => (
              <div key={item.key} className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-start">
                <Input
                  label={ii === 0 ? 'Field' : undefined}
                  aria-label={`Field name, group ${gi + 1} row ${ii + 1}`}
                  placeholder="Field name"
                  list={listId}
                  maxLength={80}
                  value={item.label}
                  error={errors[`specifications.${gi}.items.${ii}.label`]}
                  onChange={(e) => updateItem(gi, ii, { label: e.target.value })}
                />
                <Input
                  label={ii === 0 ? 'Value' : undefined}
                  aria-label={`Field value, group ${gi + 1} row ${ii + 1}`}
                  placeholder="Value"
                  maxLength={300}
                  value={item.value}
                  error={errors[`specifications.${gi}.items.${ii}.value`]}
                  onChange={(e) => updateItem(gi, ii, { value: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className={ii === 0 ? 'sm:mt-[1.625rem]' : ''}
                  aria-label={`Remove field ${item.label || ii + 1}`}
                  onClick={() => updateGroup(gi, { items: group.items.filter((_, i) => i !== ii) })}
                  disabled={group.items.length === 1}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>

          <Button variant="secondary" size="sm" className="mt-4" onClick={() => updateGroup(gi, { items: [...group.items, emptyItem()] })}>
            <Plus size={16} /> Add field
          </Button>
        </fieldset>
      ))}

      <Button variant="secondary" onClick={() => onChange([...value, emptyGroup()])}>
        <Plus size={16} /> Add specification group
      </Button>
    </div>
  );
}
