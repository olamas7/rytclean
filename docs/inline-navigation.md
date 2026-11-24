# Shared inline navigation

Navigation into a section, creation/edit form or detail view uses the page body, not a popup. Root/menu pages have no Back control. The Manager menu places Settings last.

## Shared API

- `client/src/utils/useInlineNavigation.js`: URL-backed sections, context parameters, explicit parent hierarchy and safe returns.
- `client/src/ui-component/InlineNavigation.jsx`: one accessible navigation landmark and labelled `LdButton`.
- `client/src/ui-component/PageLayout.jsx`: `PageHeader` displays the shared navigation above the heading, focuses the heading when changing inline views and disables Back while saving.

```jsx
const sections = {
    plans: { label: 'Plan Settings' },
    'new-plan': { label: 'New Plan', parent: 'plans' },
    'edit-plan': { label: 'Edit Plan', parent: 'plans' }
};

const inline = useInlineNavigation({
    sections,
    rootLabel: 'Settings',
    parameter: 'section', // defaults to view
    contextKeys: ['plan'],
    blocked: saving
});

// Open from the root/parent; these actions push same-page browser history.
inline.open('plans');
inline.open('edit-plan', { plan: selected.id });

<PageHeader title="Edit Plan" inlineNavigation={inline.navigation} />

// User cancellation respects blocked state; successful saves can close while
// their pending state is still being cleared in finally.
inline.back();
inline.close();
```

Section definitions should be stable constants outside the component. Only declared views/context keys may be opened. Each section's `parent` identifies its immediate parent; omit it for sections returning to the root. If a nested parent itself requires an identifier, declare that parent's `contextKeys` (a subset of the hook's context keys) to preserve it for direct-link fallback.

## Behaviour

- Sections are query parameters, so refreshes/direct links can reopen them. Record IDs are resolved from authorised API data; a missing record must show an error with working Back, never silently become a create request.
- Normal openings record their same-page origin in router state. Back uses the preceding inline browser-history entry only when the recorded pathname, section parameter and expected parent match. Browser Back/Forward also follows the inline openings.
- Direct links or unrecognised origins return to the declared parent by replacing the current query, not by blindly calling `navigate(-1)` and possibly leaving the app. Only this hook's context keys/section parameter are cleared; unrelated query parameters/hash remain.
- Hooks coexist by using different query parameters: an account can use `view=account&customer=ID`, and its nested payment form uses `action=payment` without dropping the account identity.
- Parent component state (such as search/filter/tab selection) remains while opening its inline child. A remounted table can still reset its internal pagination; exact table scroll/page restoration is not implemented.
- Back and Cancel are disabled/guarded during a save; mutation handlers also retain request locks. Browser toolbar/sidebar navigation is not globally blocked, and there is no global unsaved-change confirmation in this change.
- Financial entry request keys are regenerated when entering a new account action; failed submissions retain their key and values. Existing server idempotency and validation remain unchanged.

## Applied screens

- Manager Settings: Plan Settings/Billing Settings, with nested new/edit plan forms.
- Customer Management: new/edit customer and customer account.
- Client Billing and accountant invoice/payment workspaces: customer account details.
- Customer account: bill details, payment/debit/credit/reversal forms, billing activation and account-level bill-generation confirmation.
- Admin User Manager: new/edit user.
- Admin Configuration: new/edit client category.
- Zones & Routes: new zone/route.
- Driver Assignment: new driver profile and pickup assignment.

Top-level tab switches (such as SMS Bulk/History) do not create nested sections and do not show a redundant Back button. Bulk-send and workspace-wide billing-run confirmations, photo previews and map previews remain dialogs; they are confirmations/previews rather than navigable sections.

## Verification

Passed focused client lint and `node scripts/check-inline-navigation.cjs`, `node scripts/check-shared-ui.cjs`, and `node scripts/check-sms-ui.cjs` from `client/`. The inline checks cover hidden root controls, shared/disabled Back rendering, safe origin validation, nested/direct-link fallbacks, query/hash/parent-ID preservation, representative section renders and Manager Settings order. Rendering is in memory, with no API calls or real financial/SMS actions. No server/schema changes or production build were needed. Full browser/mobile interaction, focus, history traversal and save/retry interaction remain to be manually verified.
