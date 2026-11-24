# Customer details update

## Local schema status

Applied and verified in the local development database. There is no separate update command for the user to run; the completed standalone migration script was removed. The reusable schema code remains in `server/migrations/customerDetails.js`, used by initial `setup_db.js` and isolated tests.

The update creates `client_categories` with Commercial and Household defaults, adds customer category/joined-date/location-description columns, and preserves existing IDs and links. Existing joined dates are populated from each record's creation date; categories remain unassigned until a user selects the appropriate one.

## Behaviour

- New customer IDs are generated on the server from 10000–99999 using cryptographic randomness. The unique database constraint and retries handle collisions. IDs are immutable on edit. This finite ID space supports at most 90,000 new numeric IDs.
- Joined date defaults to today's date in Ghana (UTC), and is editable.
- Client category is required for new/edit customer submissions. Existing unknown categories are not guessed.
- Category configuration is in Admin → Configuration → Client Categories. Administrators can add, rename, activate and deactivate categories. No delete operation is offered, preserving customer history.
- Inactive categories/zones/plans may remain on customers already using them, but cannot be newly selected. Existing missing legacy options must be replaced with valid options before saving.
- Customer updates preserve pickup scheduling and IDs.
- The customer table uses the shared normal MUI table and displays names, category, joined date and location description, with search, filters, pagination and error/retry states.
- Maps now use Google Maps with Ghana-focused Places search, draggable pins, manual coordinate entry, optional browser location sharing and external driving-navigation links. Saved coordinates and descriptions are retained. See `docs/google-maps.md`.

The focused database migration was applied successfully to the configured development database. Builds/tests and browser verification have not been run, per the user's execution preference.
