import { cn } from '../../lib/cn.js';
import { Field, controlClasses } from './Field.jsx';

export function Textarea({ label, hint, error, required, className, fieldClassName, id, rows = 4, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={fieldClassName} id={id}>
      {(aria) => <textarea {...aria} rows={rows} className={cn(controlClasses(error), 'py-2.5', className)} {...props} />}
    </Field>
  );
}
