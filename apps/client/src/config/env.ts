const defaultBaseUrl = `http://${window.location.hostname}:3001`;

// Prefer explicit API base URL for both HTTP and Socket.io.
// Keep VITE_SERVER_URL as backward-compatible fallback.
export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_SERVER_URL ??
  defaultBaseUrl;
