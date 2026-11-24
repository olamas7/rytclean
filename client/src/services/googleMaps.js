export const DEFAULT_MAP_CENTER = { lat: 5.6037, lng: -0.187 };
export const MAP_AUTH_ERROR_EVENT = 'rytclean:maps-auth-error';
export const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim();

let loader;
let authenticationFailed = false;

export const loadGoogleMaps = () => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
    if (!key || !GOOGLE_MAP_ID) return Promise.reject(new Error('Google Maps is not configured. Set the API key and map ID in client/.env, then restart the client.'));
    if (authenticationFailed) return Promise.reject(new Error('Google Maps access was denied. Check billing, enabled APIs and website/key restrictions.'));
    if (loader) return loader;

    loader = new Promise((resolve, reject) => {
        let settled = false;
        let script;
        const finish = (error) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            if (error) {
                script?.remove();
                delete window.rytCleanGoogleMapsReady;
                reject(error);
            } else resolve(window.google.maps);
        };
        const timeout = window.setTimeout(() => finish(new Error('Google Maps timed out. Check your connection and try again.')), 20000);
        const previousAuthFailure = window.gm_authFailure;
        window.gm_authFailure = () => {
            authenticationFailed = true;
            window.dispatchEvent(new Event(MAP_AUTH_ERROR_EVENT));
            previousAuthFailure?.();
            finish(new Error('Google Maps access was denied. Check billing, enabled APIs and website/key restrictions.'));
        };
        window.rytCleanGoogleMapsReady = async () => {
            try {
                await Promise.all([window.google.maps.importLibrary('maps'), window.google.maps.importLibrary('marker')]);
                if (authenticationFailed) throw new Error('Google Maps access was denied. Check the browser console for Google’s error code.');
                finish();
            } catch {
                finish(new Error('Unable to initialise Google Maps. Check the enabled APIs and browser console.'));
            }
        };
        if (window.google?.maps?.importLibrary) {
            window.rytCleanGoogleMapsReady();
            return;
        }
        script = document.createElement('script');
        const url = new URL('https://maps.googleapis.com/maps/api/js');
        url.search = new URLSearchParams({ key, loading: 'async', v: 'weekly', region: 'GH', language: 'en', callback: 'rytCleanGoogleMapsReady' }).toString();
        script.src = url.toString();
        script.async = true;
        script.nonce = document.querySelector('script[nonce]')?.nonce || '';
        script.onerror = () => finish(new Error('Unable to download Google Maps. Check your connection or browser content blockers.'));
        document.head.appendChild(script);
    }).catch((error) => {
        loader = null;
        throw error;
    });
    return loader;
};

export const toMapPoint = (latitude, longitude) => {
    if ([latitude, longitude].some((value) => (typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '')) return null;
    const lat = Number(latitude);
    const lng = Number(longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
};

export const readGeoJson = (value) => {
    try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; }
};

export const polygonPaths = (value) => {
    const geo = readGeoJson(value);
    if (geo?.type !== 'Polygon' || !Array.isArray(geo.coordinates)) return [];
    return geo.coordinates.map((ring) => {
        if (!Array.isArray(ring)) return [];
        const points = ring.map((point) => Array.isArray(point) ? toMapPoint(point[1], point[0]) : null).filter(Boolean);
        if (points.length > 1 && points[0].lat === points.at(-1).lat && points[0].lng === points.at(-1).lng) points.pop();
        return points;
    });
};

export const linePoints = (value) => {
    const geo = readGeoJson(value);
    return geo?.type === 'LineString' && Array.isArray(geo.coordinates)
        ? geo.coordinates.map((point) => Array.isArray(point) ? toMapPoint(point[1], point[0]) : null).filter(Boolean) : [];
};

export const toPolygonGeoJson = (paths) => {
    if (!paths[0]?.length) return null;
    return { type: 'Polygon', coordinates: paths.map((path) => {
        const points = path.map(({ lat, lng }) => [lng, lat]);
        return points.length >= 3 ? [...points, [...points[0]]] : points;
    }) };
};

export const toLineGeoJson = (points) => points.length ? { type: 'LineString', coordinates: points.map(({ lat, lng }) => [lng, lat]) } : null;
