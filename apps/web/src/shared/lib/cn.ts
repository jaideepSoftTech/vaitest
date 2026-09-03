import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn/ui's standard class-merge helper. shared/ui/** imports nothing from
// features or shared/domain (06-TEAM-FRONTEND.md §1.1, layering rule #3) —
// this file is the one exception every primitive is allowed to depend on.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
