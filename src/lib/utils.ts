import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms = 10_000,
  message = "Request timed out"
): Promise<T> {
  let timer: number | undefined;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = window.setTimeout(() => {
        reject(new Error(message));
      }, ms);
    }),
  ]).finally(() => {
    if (timer) window.clearTimeout(timer);
  });
}

