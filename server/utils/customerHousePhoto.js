const multer = require('multer');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs/promises');

// Outside the public images directory; photos are served only through JWT-protected routes.
const PHOTO_DIRECTORY = path.resolve(__dirname, '../uploads/customer-house-photos');
const validKey = (key) => typeof key === 'string' && /^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key);
const photoPath = (key) => validKey(key) ? path.join(PHOTO_DIRECTORY, key) : null;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 25, fieldSize: 4096, parts: 27 },
  fileFilter: (req, file, callback) => callback(['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ? null : new Error('Use a JPG, PNG or WebP photo.'), true),
}).single('housePhoto');

const imageType = (buffer) => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { extension: 'jpg', mime: 'image/jpeg' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension: 'png', mime: 'image/png' };
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { extension: 'webp', mime: 'image/webp' };
  return null;
};

const receiveHousePhoto = (req, res, next) => upload(req, res, (error) => {
  if (error) return res.status(400).json({ code: 2, message: error.code === 'LIMIT_FILE_SIZE' ? 'The house photo must be no larger than 5 MB.' : 'Unable to accept the upload. Use one JPG, PNG or WebP photo up to 5 MB.' });
  if (req.file && !imageType(req.file.buffer)) return res.status(400).json({ code: 2, message: 'This file is not a supported image. Use a valid JPG, PNG or WebP photo.' });
  return next();
});

async function removePhoto(key) {
  const filename = photoPath(key);
  if (!filename) return;
  try { await fs.unlink(filename); } catch (error) {
    if (error.code !== 'ENOENT') console.warn('An unused house photo could not be removed.');
  }
}

async function storePhoto(file) {
  const type = imageType(file.buffer);
  if (!type) throw new Error('Unsupported image.');
  const key = `${randomUUID()}.${type.extension}`;
  await fs.mkdir(PHOTO_DIRECTORY, { recursive: true });
  try { await fs.writeFile(photoPath(key), file.buffer, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') await removePhoto(key); throw error; }
  return { key, mime: type.mime };
}

module.exports = { receiveHousePhoto, storePhoto, removePhoto, photoPath };
