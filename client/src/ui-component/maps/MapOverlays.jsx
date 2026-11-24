import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useGoogleMap } from './GoogleMap';

const popupContent = (text) => {
    const element = document.createElement('div');
    element.textContent = text;
    element.style.whiteSpace = 'pre-line';
    element.style.maxWidth = '260px';
    element.style.color = '#192b60';
    return element;
};

export const MapMarker = ({ position, title = '', label = '', popup, draggable = false, onDragEnd, color = '#2674ed' }) => {
    const map = useGoogleMap();
    const markerRef = useRef(null);
    const callback = useRef(onDragEnd);
    callback.current = onDragEnd;
    const popupRef = useRef(popup);
    popupRef.current = popup;
    const clickable = Boolean(popup);
    useEffect(() => {
        if (!map) return;
        const maps = window.google.maps;
        const marker = new maps.marker.AdvancedMarkerElement({ map });
        markerRef.current = marker;
        const info = new maps.InfoWindow();
        const click = marker.addListener('click', () => {
            if (!popupRef.current) return;
            info.setContent(popupContent(popupRef.current));
            info.open({ map, anchor: marker, shouldFocus: false });
        });
        const drag = marker.addListener('dragend', (event) => {
            if (event.latLng) callback.current?.({ lat: Number(event.latLng.lat().toFixed(7)), lng: Number(event.latLng.lng().toFixed(7)) });
        });
        return () => { click.remove(); drag.remove(); info.close(); marker.map = null; markerRef.current = null; };
    }, [map]);
    useEffect(() => {
        if (!markerRef.current) return;
        markerRef.current.position = position;
        markerRef.current.title = title;
        markerRef.current.gmpDraggable = draggable;
        markerRef.current.gmpClickable = clickable;
    }, [map, position.lat, position.lng, title, draggable, clickable]);
    useEffect(() => {
        if (!markerRef.current || !label) return;
        const content = document.createElement('div');
        Object.assign(content.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' });
        const caption = document.createElement('div');
        caption.textContent = label;
        caption.title = label;
        Object.assign(caption.style, {
            padding: '5px 9px', borderRadius: '7px', background: '#fff', color: '#192b60',
            border: '1px solid #cdd7e7', boxShadow: '0 2px 8px rgba(25,43,96,0.16)',
            font: '600 11px/1.4 system-ui, sans-serif', maxWidth: '240px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        });
        const pin = document.createElement('div');
        Object.assign(pin.style, { width: '14px', height: '14px', borderRadius: '50%', background: color, border: '2px solid #fff', boxShadow: '0 1px 5px rgba(25,43,96,0.35)' });
        content.append(caption, pin);
        markerRef.current.replaceChildren(content);
    }, [map, label, color]);
    return null;
};

MapMarker.propTypes = {
    position: PropTypes.shape({ lat: PropTypes.number.isRequired, lng: PropTypes.number.isRequired }).isRequired,
    title: PropTypes.string, label: PropTypes.string, popup: PropTypes.string, draggable: PropTypes.bool, onDragEnd: PropTypes.func, color: PropTypes.string
};

// Direct Polygon/Polyline editing replaces Google's retired Drawing Library.
// Keep the native shape alive while dragging to avoid resetting the vertex under the pointer.
export const MapShape = ({ paths, polygon = false, editable = false, onChange, popup, color }) => {
    const map = useGoogleMap();
    const shapeRef = useRef(null);
    const syncRef = useRef(null);
    const callback = useRef(onChange);
    callback.current = onChange;
    const popupRef = useRef(popup);
    popupRef.current = popup;
    const pathsKey = JSON.stringify(paths);

    useEffect(() => {
        if (!map) return;
        const maps = window.google.maps;
        const shape = polygon
            ? new maps.Polygon({ map, paths: [], editable, strokeColor: '#2c9596', strokeWeight: 2, fillColor: '#9bcec2', fillOpacity: 0.3 })
            : new maps.Polyline({ map, path: [], editable, strokeColor: '#265074', strokeWeight: 4 });
        shapeRef.current = shape;
        let pathListeners = [];
        const info = new maps.InfoWindow();
        const readPaths = () => (polygon ? shape.getPaths().getArray() : [shape.getPath()]).map((path) => path.getArray().map((point) => ({ lat: Number(point.lat().toFixed(7)), lng: Number(point.lng().toFixed(7)) })));
        const bindPaths = () => {
            pathListeners.forEach((listener) => listener.remove());
            pathListeners = [];
            if (!editable) return;
            (polygon ? shape.getPaths().getArray() : [shape.getPath()]).forEach((path) => {
                ['set_at', 'insert_at', 'remove_at'].forEach((event) => pathListeners.push(path.addListener(event, () => callback.current?.(readPaths()))));
            });
        };
        syncRef.current = (nextPaths) => {
            if (JSON.stringify(readPaths()) === JSON.stringify(nextPaths)) return;
            pathListeners.forEach((listener) => listener.remove());
            if (polygon) shape.setPaths(nextPaths);
            else shape.setPath(nextPaths[0] || []);
            bindPaths();
        };
        const click = shape.addListener('click', (event) => {
            if (!popupRef.current || !event.latLng) return;
            info.setContent(popupContent(popupRef.current));
            info.setPosition(event.latLng);
            info.open({ map, shouldFocus: false });
        });
        return () => {
            pathListeners.forEach((listener) => listener.remove());
            click.remove(); info.close(); shape.setMap(null); shapeRef.current = null; syncRef.current = null;
        };
    }, [map, polygon, editable]);
    useEffect(() => { syncRef.current?.(JSON.parse(pathsKey)); }, [map, polygon, editable, pathsKey]);
    useEffect(() => { if (color) shapeRef.current?.setOptions({ strokeColor: color }); }, [map, polygon, editable, color]);
    return null;
};

MapShape.propTypes = { paths: PropTypes.array.isRequired, polygon: PropTypes.bool, editable: PropTypes.bool, onChange: PropTypes.func, popup: PropTypes.string, color: PropTypes.string };
