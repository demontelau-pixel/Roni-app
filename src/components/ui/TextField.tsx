import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/** Ported from `.field` / `.field input`. */
export function TextField({ label, id, ...rest }: TextFieldProps) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-bold">{label}</span>
      <input
        id={id}
        className="w-full rounded-2xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-primary"
        {...rest}
      />
    </label>
  );
}
