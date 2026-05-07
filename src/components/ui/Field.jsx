import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Field — canonical labelled form-field wrapper.
 * Rules enforced:
 *   • Red asterisk on required fields with NO space before it (QA rule).
 *   • Error text appears below the input, never floating or inline.
 *   • Label is associated with the control via htmlFor / id (a11y).
 *
 * Props:
 *   label     — label text
 *   required  — show red asterisk
 *   error     — validation message (string)
 *   hint      — secondary helper text (string, below input, hidden when error)
 *   htmlFor   — override for the generated id (optional)
 *   children  — either the input element directly OR a render-prop fn({ id, 'aria-invalid', 'aria-describedby' })
 *   className — wrapper class
 */
export default function Field({
  label,
  required = false,
  error,
  hint,
  htmlFor,
  children,
  className = '',
}) {
  const autoId = useId();
  const id = htmlFor || `field-${autoId}`;
  const describedById = error
    ? `${id}-error`
    : hint
    ? `${id}-hint`
    : undefined;

  const controlProps = {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedById,
    'aria-required': required || undefined,
  };

  const renderedChild =
    typeof children === 'function'
      ? children(controlProps)
      : React.isValidElement(children)
      ? React.cloneElement(children, {
          id: children.props.id || id,
          'aria-invalid': error ? true : children.props['aria-invalid'],
          'aria-describedby':
            describedById || children.props['aria-describedby'],
          'aria-required':
            required || children.props['aria-required'] || undefined,
        })
      : children;

  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400"
        >
          {label}
          {required && (
            <span aria-hidden="true" className="text-red-500">
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </label>
      )}
      {renderedChild}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500 dark:text-red-400"
        >
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${id}-hint`}
          className="mt-1 text-[11px] text-slate-400 dark:text-slate-500"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
