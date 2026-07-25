export function maskCalendarUrl(value: string): string {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").map((segment) => segment.length > 12
      ? `${segment.slice(0, 4)}********${segment.endsWith(".ics") ? ".ics" : ""}`
      : segment);
    const query = [...url.searchParams.keys()].map((key) => `${encodeURIComponent(key)}=********`).join("&");
    return `${url.origin}${segments.join("/")}${query ? `?${query}` : ""}`;
  } catch {
    return "잘못된 URL";
  }
}
