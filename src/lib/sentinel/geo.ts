import { sentinelFetch, SentinelError } from './client';

export type GeoInfo = {
  ip: string;
  country: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  isPrivate: boolean;
};

/** Returns null if the IP hasn't been looked up by Sentinel yet (404), rather than throwing. */
export async function getGeo(ip: string): Promise<GeoInfo | null> {
  try {
    return await sentinelFetch<GeoInfo>(`/geo/${encodeURIComponent(ip)}`);
  } catch (err) {
    if (err instanceof SentinelError && err.status === 404) return null;
    throw err;
  }
}
