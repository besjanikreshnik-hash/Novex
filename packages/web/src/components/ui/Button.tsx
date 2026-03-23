"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "success" | "danger" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loading?: boolean; // alias for isLoading
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-novex-primary hover:bg-novex-primary-hover text-white shadow-lg shadow-novex-primary/20",
  success:
    "bg-novex-success hover:bg-novex-success-hover text-white shadow-lg shadow-novex-success/20",
  danger:
    "bg-novex-danger hover:bg-novex-danger-hover text-white shadow-lg shadow-novex-danger/20",
  ghost:
    "bg-transparent hover:bg-dark-700 text-text-secondary hover:text-text-primary",
  outline:
    "bg-transparent border border-border hover:border-border-light text-text-secondary hover:text-text-primary",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs font-medium rounded-md",
  md: "h-10 px-4 text-sm font-medium rounded-lg",
  lg: "h-12 px-6 text-base font-semibold rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading: isLoadingProp = false,
      loading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoadingProp || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 transition-all duration-150 font-medium",
          "focus:outline-none focus:ring-2 focus:ring-novex-primary/50 focus:ring-offset-1 focus:ring-offset-dark-900",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
          "active:scale-[0.98]",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {(isLoadingProp || loading) && (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
