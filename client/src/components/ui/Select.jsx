import { cn } from '../../lib/cn.js';
import { Field, controlClasses } from './Field.jsx';

export function Select({ label, hint, error, required, className, fieldClassName, id, children, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={fieldClassName} id={id}>
      {(aria) => (
        <select {...aria} className={cn(controlClasses(error), 'h-11 pr-8', className)} {...props}>
          {children}
        </select>
      )}
    </Field>
  );
}
