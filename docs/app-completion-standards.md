# RytClean completion agreement

This is the persistent checklist for page-by-page completion. It supplements the historical frontend-only plans; it is not a claim that these features are already finished.

## Shared UI contract

- **Tables:** normal semantic MUI tables, using `AppTable` from `utils/controls/Tables`. No DataGrid. Shared headers, sorting, pagination, horizontal scrolling, row actions, loading, empty and error handling. Search/filter server-side when dataset size requires it; the initial shared table supports client-side data only.
- **Table appearance:** match the supplied Purchase Requisitions reference, adapted to each domain: rounded white container, title and record count on the left, compact rounded search/filter controls on the right, right-aligned secondary toolbar actions, pale blue-grey headers, thin dividers, small navy text, bold primary/muted secondary row text, dotted pill statuses and compact outlined icon actions. `TableFilter`, `TablePrimaryText` and `TableActionButton` share these patterns. Keep icon actions labelled for assistive technology with useful tooltips. The reference's export/print/date controls are not placeholders to copy: only add them when they have working domain-appropriate behaviour.
- **Buttons:** `LdButton` from `utils/myButtons` for all actions. Use `loading` for pending operations, `type="submit"` only for form submission, and descriptive labels. Do not replace native table sorting/pagination or close/navigation icon controls with misleading submit controls.
- **Fields:** reuse React Hook Form controls; show required indicators, field-specific validation and useful helper text. Keep names, sizes, spacing and labels consistent.
- **Structure:** page heading/description and primary action, then filters, then content. Use `PageHeader`, `TableToolbar`, `DataState` and `FormActions` where appropriate.
- **Inline navigation:** navigable forms/details/sections open inline with URL-backed `useInlineNavigation` and the shared `PageHeader inlineNavigation` Back control. It appears only inside a section, names the parent and is disabled during saves. Preserve parent filters/context, support direct links/refresh and declare nested parents. Confirmation and media/map-preview dialogs are not section navigation. Manager Settings remains the last Manager menu item. See `docs/inline-navigation.md`.
- **Style:** theme colours, consistent spacing, readable typography and one `StatusBadge` status vocabulary. Avoid hardcoded icon colours and duplicated status palettes.

## Checklist for each page

- [ ] Confirm what is API-backed, mocked or still a placeholder; do not report local-only actions as saved.
- [ ] Use current authorised user/customer/driver context, not fixed demo IDs.
- [ ] Show names first and identifiers second; use helpful location/address text rather than raw coordinates alone.
- [ ] Provide relevant search, resettable filters, sorting and pagination; customer search should include phone and customer filters should include zone/plan.
- [ ] Handle initial loading, refresh, no records, no search results, API failures and retry separately.
- [ ] Validate on client and server. Prevent duplicate submissions; preserve form values when saving fails.
- [ ] Explain unavailable actions. Never show missing prerequisites while they are still loading.
- [ ] Confirm destructive actions and guard unsaved edits where appropriate.
- [ ] Check mobile widths, table overflow, dialog scrolling, keyboard focus, labels and touch targets in the browser.
- [ ] Use shared GHS/date formatting; date-only values must not shift with timezone conversion.
- [ ] Open pickup/ticket details from a selected record rather than a generic fixed record.
- [ ] Replace fake success, export, payment, proof upload and chart placeholders as the feature is implemented.
- [ ] Inspect changes and run relevant tests/quick syntax checks. Per updated user preference, skip production builds unless explicitly requested; avoid repetitive unrelated checks and clearly note what has not been verified.

## Google Maps plan

The six existing Leaflet components have now been replaced: customer picker, customer preview, all-customer map, zone boundary editor, zone coverage map and route path editor. See `docs/google-maps.md` for current implementation and verification status. Driver navigation/tracking placeholders and calculated road routes are additional work. The following remain implementation/maintenance guardrails:

- Create one shared loader/provider with missing-key, loading and failure handling.
- Use restricted browser keys, separate server credentials where needed, billing monitoring and quotas. Do not commit keys.
- Use current Places APIs for Ghana-focused search; retain manual pin, landmark and optional GhanaPost GPS entry. Test actual service areas.
- Preserve latitude/longitude and GeoJSON. GeoJSON uses `[longitude, latitude]`; map APIs often use `{ lat, lng }`.
- Use supported polygon/polyline editing; Google's old Drawing Library was retired in May 2026.
- Use road routing for distances/ETAs rather than treating manually drawn lines as drivable routes.
- Navigation links can be added before full embedded navigation. Live tracking requires consent, GPS updates, access controls and backend persistence; maps alone do not supply it.
- Review Google storage/licensing rules before persisting provider-derived place/address/route data.

## Production backlog to address with relevant features

- Hash passwords; remove fallback JWT secrets; enforce backend role/record authorisation.
- Connect customer, driver, finance, support and supervisor mock workflows to persistent APIs.
- Add payment/invoice/support storage and safe migrations when those features are requested.
- Verify existing database migration compatibility against the actual MySQL/MariaDB version before running setup.
- Keep documentation aligned with the real app, not inherited POS/template assumptions.

## Prepared shared components

```jsx
import { AppTable, TableToolbar } from 'utils/controls/Tables';
import { PageHeader, FormActions } from 'ui-component/PageLayout';
import { LdButton } from 'utils/myButtons';
import { formatCurrency, formatDate } from 'utils/formatters';

// Filter rows in the page/service; AppTable sorts and paginates the supplied rows.
const columns = [
    { id: 'fullName', label: 'Customer', sortable: true },
    { id: 'amount', label: 'Amount', align: 'right', sortable: true, render: (row) => formatCurrency(row.amount) },
    { id: 'actions', label: 'Actions', align: 'right', render: (row) => <LdButton onClick={() => edit(row)}>Edit</LdButton> }
];

<AppTable
    ariaLabel="Customers"
    columns={columns}
    rows={filteredCustomers}
    loading={loading}
    error={errorMessage}
    onRetry={reload}
    emptyTitle="No customers found"
    emptyDescription="Try changing your search or filters."
    toolbar={<TableToolbar searchValue={query} onSearchChange={setQuery} searchLabel="Search customers" filters={filterControls} />}
/>;
```

Existing screens are migrated incrementally, not silently rewritten as part of foundation work. `CustomDataGrid.jsx` is legacy and unused; it is not the approved table standard.
