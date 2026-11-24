# Google Maps integration

## Configuration

Set `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_MAP_ID` in `client/.env` and restart Vite after changing them. Both are browser configuration, not server secrets; protect the browser key with website and API restrictions and keep credentials out of Git. Use a JavaScript map ID with advanced-marker support.

Required services: Maps JavaScript API and Places API (New). Set Google Cloud budget alerts and service quotas; budget alerts alone do not cap spending. Keep production and development website restrictions accurate.

## Implemented

- One on-demand loader shared across screens; no extra React map package is required.
- Shared loading, configuration, authorization and download-failure UI with custom retry buttons.
- Customer picker: Ghana-only Places (New) suggestions, selection details, map-click and draggable exact pins, satellite map option, coordinate entry and optional browser geolocation.
- Moving a pin clears the previous location address instead of keeping an incorrect Google search address; the user can enter/confirm the correct address. Customer location description remains independent.
- Customer preview: advanced marker and external Google Maps driving-navigation link.
- Customer map: independent search and status/category/zone/plan filters inside the map view, reset to all customers, visible ID/name marker labels, safe text popups, uppercase names and automatic bounds. Opens with current table filters; changing/resetting map filters does not change the table. Matching customers without valid coordinates are counted explicitly.
- Zone coverage: saved polygons including interior rings, details on click and automatic bounds.
- Boundary/route fields: click to add points, drag existing vertices/midpoints, undo last point and clear. Uses native Polygon/Polyline, not the retired Drawing Library.
- Existing database coordinates and GeoJSON are retained. GeoJSON remains `[longitude, latitude]`; browser map points use `{ lat, lng }`. No data migration was needed for map replacement.

Google map controls and Google Places' own accessible search widget are provider UI; app-owned actions use `LdButton`.

## Important limitations

- Route editing is a manually planned line, not calculated road navigation or an ETA. Routes API integration is separate work.
- Live driver tracking, route optimisation and marker clustering are not implemented in this change.
- Field registration uses **Capture GPS Location**: the registering person must stand at the customer's property/pickup entrance. A fresh, high-accuracy device position is requested, the pin is placed, and reported accuracy is shown. Readings wider than 50 metres receive a warning to retry outdoors or adjust the pin. Devices may use GPS, Wi-Fi or other positioning; accuracy is not guaranteed. The coordinates are persisted only when the customer form is saved; accuracy feedback is session-only. Saving is disabled during capture. This is a one-time capture, not continuous tracking.
- Geolocation requires permission and a secure context (HTTPS, or localhost in development). Location requests begin only when the user selects **Capture GPS Location**. Accessing a development machine's plain HTTP LAN address from a phone generally cannot use browser geolocation; use an HTTPS deployment/tunnel instead.
- Places operations are billed separately from map loads. Only address and coordinate fields are requested. Do not add automatic reverse-geocoding requests on every pin drag.
- Follow Google Maps Platform storage, caching and attribution terms when extending provider-derived data handling. Never remove Google attribution.
- Old Leaflet packages may remain installed, but application code no longer imports Leaflet, its CSS, OSM tiles or Nominatim. Dependency/lockfile cleanup can be done separately without blocking this change.

## Verification status

The user confirmed `maps-check.html` works before replacement. The migrated screens have been reviewed in source only; no build, automated tests, or post-migration browser execution was performed, per user preference. `http://localhost:8101/maps-check.html` remains available as a development-only connection diagnostic.
