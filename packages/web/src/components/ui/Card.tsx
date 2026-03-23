"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  noPadding?: boolean;
  header?: ReactNode;
}

export function Card({
  children,
  className,
  noPadding = false,
  header,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-dark-800 border border-border rounded-xl overflow-hidden",
        className
      )}
      {...props}
    >
      {header && (
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          {typeof header === "string" ? (
            <h3 className="text-sm font-semibold text-text-primary">
              {header}
            </h3>
          ) : (
            header
          )}
        </div>
      )}
      <div className={cn(!noPadding && "p-4")}>{children}</div>
    </div>
  );
}
