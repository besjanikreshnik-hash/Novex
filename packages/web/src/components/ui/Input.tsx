"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, prefix, suffix, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-text-secondary mb-1.5"
          >
            {label}
          </label>
        )}
        <div
          className={cn(
            "flex items-center w-full rounded-lg border bg-dark-900 transition-colors duration-150",
            error
              ? "border-novex-danger focus-within:border-novex-danger"
              : "border-border focus-within:border-border-focus",
            className
          )}
        >
          {prefix && (
            <span className="pl-3 text-text-tertiary text-sm flex-shrink-0">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "flex-1 bg-transparent px-3 py-2.5 text-sm text-text-primary",
              "placeholder:text-text-muted",
              "focus:outline-none",
              "font-mono",
              "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              !prefix && "pl-3",
              !suffix && "pr-3"
            )}
            {...props}
          />
          {suffix && (
            <span className="pr-3 text-text-tertiary text-sm flex-shrink-0">
              {suffix}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs text-novex-danger">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1 text-xs text-text-tertiary">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
