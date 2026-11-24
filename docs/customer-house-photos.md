# Customer house/frontage photos

## Field registration

In Add/Edit Customer, use **Take Photo** (rear-camera hint on supported phones) or **Choose Photo**. A preview is shown before saving. JPG, PNG and WebP input up to 15 MB is accepted by the form, then resized to at most 1800px and compressed toward 1 MB as JPEG. Normal form processing does not preserve EXIF metadata. Unsupported HEIC images should be converted or captured using JPEG/Most Compatible settings.

The photo is optional. Saving the customer uploads it; cancellation does not upload it. Existing photos can be replaced, removed on save, or retained with **Keep Saved Photo**. Failed saves retain the pending selection. Save is disabled while photo processing/GPS capture is pending.

The customer table has a camera action to view an attached photo. The customer location preview also shows the saved house photo when available. Photos are loaded only when needed, not as part of every customer list response.

Take only the frontage/pickup entrance needed for identification, with client permission; avoid people and private interiors.

## Server and persistence

- Schema update is already applied and verified locally. Its completed standalone script was removed; initial setup/tests reuse `server/migrations/customerHousePhoto.js`. No separate user command is needed.
- Adds nullable `house_photo_key` and `house_photo_mime` columns; existing customer IDs and data are unaffected.
- Uploads use multipart `housePhoto` on the existing customer POST/PATCH routes. No-photo JSON submissions still work. `removeHousePhoto: true` removes a saved image on update.
- Server limits uploads to one JPG/PNG/WebP image up to 5 MB, checks the file signature and MIME allowlist, and generates its own filename.
- Files are stored outside the public images directory in `server/uploads/customer-house-photos`, excluded from Git.
- Reads use `GET /api/admin/customers/:id/house-photo` behind existing JWT middleware. The frontend obtains an authenticated blob URL; no token is put in the image URL.
- Customer details and photo metadata commit in one database transaction. Newly written files are removed on failed saves; replaced files are removed after commit. A crash between disk writes and database commit can still leave an unreferenced file, so operational cleanup should reconcile files against database keys before deletion.
- Photos inherit the existing customer API's signed-in staff access model; this feature does not introduce finer-grained staff permissions.

## Deployment

Persist and back up **both** the database and `server/uploads/customer-house-photos`. Use a persistent volume when deploying in containers. Do not place the private upload folder under a public static-file mount. A future object-storage migration must preserve authenticated access.

No builds, automated tests or browser execution were run for this change, per user preference.

The focused house-photo schema migration was applied successfully to the configured development database.
