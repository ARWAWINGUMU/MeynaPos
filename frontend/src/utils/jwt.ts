interface JwtPayload {
  exp?: number;
  sub?: string;
  role?: string;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "=");
    const decodedPayload = window.atob(paddedPayload);
    return JSON.parse(decodedPayload) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    return true;
  }
  return payload.exp * 1000 <= Date.now();
}

export function getTokenExpirationTime(token: string): number | null {
  const payload = decodeJwtPayload(token);
  return payload?.exp ? payload.exp * 1000 : null;
}
