import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Wrap a Promise (or a thenable like Supabase query builder) with a timeout.
 * If the promise doesn't resolve within `ms`, it rejects with `message`.
 */
export function withTimeout<T>(
  promiseOrThenable: Promise<T> | PromiseLike<T>,
  ms = 10_000,
  message = "Request timed out"
): Promise<T> {
  // Ensure we have a real Promise (Supabase query builders are thenables)
  const promise = Promise.resolve(promiseOrThenable);
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

