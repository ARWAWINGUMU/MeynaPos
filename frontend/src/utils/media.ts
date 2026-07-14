const backendBaseUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api").replace(/\/api\/?$/, "");

export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) {
    return null;
  }
  if (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  return `${backendBaseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}
