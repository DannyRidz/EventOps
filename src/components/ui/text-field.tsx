"use client";
import { useId, type InputHTMLAttributes } from "react";

type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "aria-invalid"
> & { readonly label: string; readonly hint?: string; readonly error?: string };

export function TextField({
  label,
  hint,
  error,
  id,
  required,
  "aria-describedby": describedBy,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descriptions =
    [
      hint ? `${fieldId}-hint` : undefined,
      error ? `${fieldId}-error` : undefined,
      describedBy,
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={fieldId}>
        {label}
        {required && (
          <span className="required-label" aria-hidden="true">
            {" "}
            (Required)
          </span>
        )}
      </label>
      {hint && (
        <p className="field-hint" id={`${fieldId}-hint`}>
          {hint}
        </p>
      )}
      <input
        {...props}
        required={required}
        id={fieldId}
        aria-describedby={descriptions}
        aria-invalid={error ? true : undefined}
      />
      {error && (
        <p className="field-error" id={`${fieldId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
