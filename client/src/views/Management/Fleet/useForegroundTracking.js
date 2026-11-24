import { useCallback, useEffect, useRef, useState } from 'react';
import { fleetPost, fleetRequestKey } from 'services/api/fleetService';

export default function useForegroundTracking(runId, enabled, onUpdate) {
    const storageKey = `rytclean-gps:${localStorage.getItem('userMID')}:${runId}`;
    const queue = useRef([]);
    const watcher = useRef(null);
    const busy = useRef(false);
    const mounted = useRef(true);
    const last = useRef(0);
    const [active, setActive] = useState(false);
    const [pending, setPending] = useState(0);
    const [message, setMessage] = useState('Tracking is off. It starts only with your permission.');
    const update = useRef(onUpdate); update.current = onUpdate;
    const persist = useCallback(() => {
        try { localStorage.setItem(storageKey, JSON.stringify(queue.current)); }
        catch { if (mounted.current) setMessage('Device storage is unavailable. Keep this page open; unsent positions may be lost on refresh.'); }
        if (mounted.current) setPending(queue.current.length);
    }, [storageKey]);
    const flush = useCallback(async () => {
        if (busy.current || !enabled || !navigator.onLine) return;
        busy.current = true;
        let changed = false;
        try {
            for (let index = 0; index < 20 && queue.current.length && mounted.current; index += 1) {
                try {
                    const data = await fleetPost(`/runs/${runId}/locations`, queue.current[0]);
                    if (!mounted.current) break;
                    queue.current.shift(); changed = true; persist();
                    if (mounted.current) setMessage(data.accepted ? 'GPS position saved. Keep this page active for reliable browser tracking.' : `GPS ignored: ${data.reason}`);
                } catch (error) {
                    if (!mounted.current) break;
                    if (error.response?.status >= 400 && error.response?.status < 500) { queue.current.shift(); persist(); if (mounted.current) setMessage(error.response.data.message || 'GPS point rejected.'); }
                    else { if (mounted.current) setMessage('Connection interrupted. Positions are buffered on this device.'); break; }
                }
            }
        } finally { busy.current = false; if (changed && mounted.current) update.current?.(); }
    }, [enabled, persist, runId]);
    const stop = useCallback(() => {
        if (watcher.current !== null) navigator.geolocation?.clearWatch(watcher.current);
        watcher.current = null;
        if (mounted.current) { setActive(false); setMessage('GPS capture stopped. Buffered positions will upload while this route page is open.'); }
    }, []);
    useEffect(() => {
        mounted.current = true;
        try { queue.current = JSON.parse(localStorage.getItem(storageKey) || '[]').filter((point) => Date.now() - Date.parse(point.capturedAt) < 86400000).slice(-500); } catch { queue.current = []; }
        setPending(queue.current.length);
        const interval = setInterval(flush, 5000);
        return () => { mounted.current = false; stop(); clearInterval(interval); };
    }, [storageKey, flush, stop]);
    const start = () => {
        if (!enabled || watcher.current !== null) return;
        if (!window.isSecureContext || !navigator.geolocation) { setMessage('GPS needs HTTPS (or localhost) and a supported browser.'); return; }
        if (!window.confirm('Share your location for this assigned work route? Browser tracking may pause when the screen locks.')) return;
        setActive(true);
        watcher.current = navigator.geolocation.watchPosition((position) => {
            if (Date.now() - last.current < 10000) return;
            last.current = Date.now();
            if (queue.current.length >= 500) { setMessage('GPS buffer is full. Stop and restore the connection before continuing.'); return; }
            queue.current.push({ requestKey: fleetRequestKey(), latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() });
            persist(); flush();
        }, (error) => { setMessage(`GPS unavailable: ${error.message}. Check device permissions and location services.`); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    };
    return { active, pending, message, start, stop, flush };
}
