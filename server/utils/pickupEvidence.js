const multer = require('multer');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs/promises');
const directory = process.env.NODE_ENV === 'test' && process.env.FLEET_TEST_EVIDENCE_DIR ? process.env.FLEET_TEST_EVIDENCE_DIR : path.resolve(__dirname, '../uploads/pickup-evidence');
const filename = (key) => /^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(String(key)) ? path.join(directory, key) : null;
function imageType(buffer) {
  if (buffer?.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return { extension: 'jpg', mime: 'image/jpeg' };
  if (buffer?.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension: 'png', mime: 'image/png' };
  if (buffer?.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { extension: 'webp', mime: 'image/webp' };
  return null;
}
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, fieldSize: 4096, parts: 12 } }).single('photo');
const receive = (req, res, next) => upload(req, res, (error) => {
  const type = req.file && imageType(req.file.buffer);
  if (error || (req.file && (!type || req.file.mimetype !== type.mime))) return res.status(400).json({ code: 2, message: 'Use one valid JPG, PNG or WebP photo up to 5 MB.' });
  next();
});
async function store(file) {
  const type = imageType(file.buffer);
  if (!type) throw new Error('Invalid evidence photo.');
  const key = `${randomUUID()}.${type.extension}`;
  await fs.mkdir(directory, { recursive: true });
  try { await fs.writeFile(filename(key), file.buffer, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') await remove(key); throw error; }
  return { key, mime: type.mime };
}
async function remove(key) { if (filename(key)) await fs.unlink(filename(key)).catch(() => {}); }
module.exports = { receive, store, remove, filename, imageType };
