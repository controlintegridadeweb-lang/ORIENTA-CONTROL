"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: ReactNode;
};

/**
 * Checkbox acessivel com label opcional. Suporta indeterminate via ref no DOM
 * (use `ref` no elemento se precisar).
 */
export function Checkbox({ className, label, id, ...rest }: CheckboxProps) {
  const merged = className
    ? `h-4 w-4 rounded border border-slate-200 text-brand focus:ring-2 focus:ring-brand/30 ${className}`
    : "h-4 w-4 rounded border border-slate-200 text-brand focus:ring-2 focus:ring-brand/30";

  const input = <input id={id} type="checkbox" className={merged} {...rest} />;

  if (label) {
    return (
      <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2">
        {input}
        <span className="text-sm text-slate-700">{label}</span>
      </label>
    );
  }

  return input;
}
