const R = 6371000;
const rad = (degrees) => degrees * Math.PI / 180;
const coordinate = (lat, lng) => typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
function metres(a, b) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}
function routeLine(value) {
  const line = typeof value === 'string' ? JSON.parse(value) : value;
  if (!line || line.type !== 'LineString' || !Array.isArray(line.coordinates) || line.coordinates.length < 2 || line.coordinates.length > 2000 || line.coordinates.some((point) => !Array.isArray(point) || !coordinate(point[1], point[0]))) throw new Error('Save a valid route path with 2–2000 coordinates first.');
  return line;
}
function deviation(point, line) {
  const scale = Math.cos(rad(point.lat));
  let nearest = Infinity;
  for (let index = 1; index < line.coordinates.length; index += 1) {
    const vector = ([lng, lat]) => ({ x: R * rad(lng - point.lng) * scale, y: R * rad(lat - point.lat) });
    const a = vector(line.coordinates[index - 1]); const b = vector(line.coordinates[index]);
    const dx = b.x - a.x; const dy = b.y - a.y;
    const t = dx || dy ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / (dx * dx + dy * dy))) : 0;
    nearest = Math.min(nearest, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return Math.round(nearest);
}
module.exports = { coordinate, metres, routeLine, deviation };
