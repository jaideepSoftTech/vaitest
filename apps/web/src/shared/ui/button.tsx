import * as React from "react";
import { cn } from "@/shared/lib/cn";

// Primitives come from shadcn/ui unmodified (06-TEAM-FRONTEND.md §6: "We do
// not fork them; we compose"). This is a hand-rolled placeholder standing in
// for the real `npx shadcn add button` output until that CLI step runs —
// same props surface, same class contract, so swapping it in later touches
// no call sites.
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
          variant === "default" && "bg-primary text-primary-foreground hover:opacity-90",
          variant === "outline" && "border border-border bg-transparent hover:bg-muted",
          variant === "ghost" && "hover:bg-muted",
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
