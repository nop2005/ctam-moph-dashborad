// Prevent third-party tracking scripts (e.g. TikTok pixel) from slowing the app down
// or spamming the console when users run ad-blockers.
//
// This does NOT affect any app business logic; it only short-circuits requests to known
// tracking endpoints.

const BLOCKED_HOSTS = new Set(["analytics.tiktok.com"]);

function isBlockedUrl(input: RequestInfo | URL | string): boolean {
  try {
    const urlString =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : "url" in input
            ? (input.url as string)
            : "";

    if (!urlString) return false;

    // Handle relative URLs
    const url = new URL(urlString, window.location.origin);
    return BLOCKED_HOSTS.has(url.host);
  } catch {
    return false;
  }
}

export function installThirdPartyAnalyticsBlocker() {
  if (typeof window === "undefined") return;

  // Patch fetch
  const originalFetch = window.fetch?.bind(window);
  if (originalFetch) {
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (isBlockedUrl(input)) {
        // Resolve successfully so no error appears in console.
        return Promise.resolve(new Response(null, { status: 204, statusText: "No Content" }));
      }
      return originalFetch(input, init);
    };
  }

  // Patch sendBeacon
  const originalBeacon = navigator.sendBeacon?.bind(navigator);
  if (originalBeacon) {
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      if (isBlockedUrl(url)) return true;
      return originalBeacon(url as any, data as any);
    };
  }
}

// Install immediately on import
installThirdPartyAnalyticsBlocker();
