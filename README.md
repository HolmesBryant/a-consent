# A-Consent

A web component suite (`<a-consent>` and `<a-consent-edit>`) that displays a GDPR-compliant dialog for managing user consent and interfaces with Google Analytics (GA) and Google Tag Manager (GTM) based on those choices.

Demo: [https://holmesbryant.github.io/a-consent/](https://holmesbryant.github.io/a-consent/)

## Features

*   **GDPR Compliance:** Provides granular consent options for common tracking categories (Analytics, Ad Tracking, Ad Personalization, Functional).
*   **Google Analytics / GTM Integration:**
    *   Automatically loads the `gtag.js` script if `window.gtagTrackingId` is defined.
    *   Sets default consent state to 'denied' for privacy.
    *   Updates GA/GTM consent state (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`, `functionality_storage`, `security_storage`) based on user choices.
*   **localStorage Persistence:** Remembers user consent choices for a configurable duration (default: 365 days).
*   **Customizable Appearance:** Use CSS Custom Properties to style the dialog.
*   **Customizable Content:** Use HTML Slots to override default text labels and descriptions.
*   **Flexible Configuration:** Control initial consent states, expiry, and behavior via attributes.
*   **Submission Effects:** Choose between 'fade' or 'explode' visual effects when the user submits their choices.
*   **Consent Editing:** Includes `<a-consent-edit>` component to provide a link/button allowing users to revisit and modify their consent settings.
*   **Required Cookies:** Option to mark functional/security cookies as 'required' (cannot be disabled by the user).

## Usage

### 1. Include the Script

Include the script tag in your HTML page, preferably in the `<head>` or early `<body>`
.
```html
<script type="module" src="a-consent.js"></script>
```

### 2. Configure Google Analytics/GTM (Optional but Recommended)

If you use Google Analytics or Google Tag Manager, define your Tracking ID on the `window` object **before** the `a-consent.js` script is loaded.

```html
<head>
    <meta charset="utf-8">
    <title>My Site</title>
    <!-- Define GA Tracking ID. Replace 'G-XXXXXXXXXX' with your actual ID -->
    <script> window.gtagTrackingId = 'G-XXXXXXXXXX' </script>

    <!-- Load the component script -->
    <script type="module" src="a-consent.js"></script>

    ....
</head>
```

*   If `window.gtagTrackingId` is set, `a-consent.js` will automatically:
    *   Initialize `dataLayer` and `gtag`.
    *   Set default consent states to `'denied'`.
    *   Load the Google `gtag.js` library asynchronously.
    *   Update consent based on user interaction with `<a-consent>`.
*   If `window.gtagTrackingId` is *not* set, the GA/GTM integration parts will be skipped, but the dialog will still function for storing preferences locally.

### 3. Add the Consent Dialog

Include the `<a-consent>` tag in the `<body>`. The dialog will appear automatically if no prior consent is found in localStorage (or if the `force` attribute is used).

```html
<body>
    <a-consent>
        <!-- You can add custom content via slots here if needed -->
    </a-consent>

    <!-- Your page content -->
    ...
</body>
```

### 4. Add the Consent Edit Link/Button (Optional)

To allow users to change their preferences later, add the `<a-consent-edit>` tag where you want the link or button to appear. Clicking it will open the consent dialog modally.

```html
<footer>
    <p><a-consent-edit></a-consent-edit></p>
    <!-- Or customize the link text -->
    <p><a-consent-edit>Cookie Settings</a-consent-edit></p>
</footer>
```

## Attributes (`<a-consent>`)

These attributes can be set directly on the `<a-consent>` HTML tag.

**Note"** The `analytics`, `ad-tracking`, `ad-personalization` and `functional` values do not override user choices once those choices are saved.

*   **`analytics`** `OPTIONAL`
    *   Sets the default *initial* state for `analytics_storage` if no saved consent exists.
    *   Acceptable values: `true`, `false`. Default is `false`.
    *   The mere presence of the attribute implicitly means `true`.
*   **`ad-tracking`** `OPTIONAL`
    *   Sets the default *initial* state for `ad_storage` and influences `ad_user_data` if no saved consent exists.
    *   Acceptable values: `true`, `false`. Default is `false`.
    *   The mere presence of the attribute implicitly means `true`.
*   **`ad-personalization`** `OPTIONAL`
    *   Sets the default *initial* state for `ad_personalization` and influences `ad_user_data` if no saved consent exists.
    *   Acceptable values: `true`, `false`. Default is `false`.
    *   The mere presence of the attribute implicitly means `true`.
*   **`deny-all`** `OPTIONAL`
    *   If set to `true`, sets the default *initial* state to deny all optional cookies. Overrides other initial state attributes like `analytics`. `functional` remains granted if set to `required`.
    *   Acceptable values: `true`, `false`. Default is `false`.
    *   The mere presence of the attribute implicitly means `true`.
    *   Setting `deny-all` to false doesn't automatically grant everything, it just means the "Deny All" option itself isn't the source of truth.
*   **`effect`** `OPTIONAL`
    *   Determines the visual effect when the consent form is submitted.
    *   Acceptable values: `'fade'`, `'explode'`. Default is `'fade'`.
*   **`expire`** `OPTIONAL`
    *   Number of days to store the user's consent choices in localStorage.
    *   Acceptable values: Any positive integer. Default is `365`.
*   **`force`** `OPTIONAL`
    *   If set to `true`, the consent dialog will always be displayed on page load, even if consent has been previously saved. Useful for testing or forcing re-consent.
    *   Acceptable values: `true`, `false`. Default is `false`.
    *   The mere presence of the attribute implicitly means true.
*   **`functional`** `OPTIONAL`
    *   Sets the default *initial* state and behavior for `functionality_storage` (and related `security_storage`).
    *   Acceptable values:
        *   `true`: Functional cookies are granted by default, user can deny permission.
        *   `false`: Functional cookies are denied by default, user can grant permission.
        *   `'required'`: Functional cookies are always granted, and the checkbox is disabled. (Default)
        *   The mere presence of the attribute, without a value, implicitly means `true`.
*   **`grant-all`** `OPTIONAL`
    *   If set to `true`, sets the default *initial* state to grant all cookies. Overrides `deny-all`.
    *   Acceptable values: `true`, `false`. Default is `false`.
    *   Setting `grant-all` to false doesn't automatically deny everything, it just means the "Grant All" option itself isn't the source of truth.

## CSS Custom Properties (`<a-consent>`)

This component exposes several custom CSS properties which affect the appearance of the dialog. You must set these properties directly on the `<a-consent>` element itself.

```css
/* Example */
a-consent {
    --bg-color: #f0f0f0;
    --text-color: #333;
    --border-color: #ccc;
    --accent-color: rebeccapurple;
    --accent-text: white;
    --min: 40px; /* Affects checkbox size, button height, tooltip icon size */
    --font-size: medium;
}
```

*   **`--bg-color`**:
    *   Background color of the main dialog and tooltips.
    *   Default: `hsl(0, 0%, 95%)`
*   **`--text-color`**:
    *   Main text color within the dialog.
    *   Default: `hsl(0, 0%, 15%)`
*   **`--border-color`**:
    *   Color used for borders (dialog main border, tooltip icon border, submit button border).
    *   Default: `hsl(0, 0%, 75%)`
*   **`--accent-color`**:
    *   Background color for the submit button and the open tooltip summary icon. Also used for the link color in `<a-consent-edit>`.
    *   Default: `dodgerblue`
*   **`--accent-text`**:
    *   Text color for the submit button and the open tooltip summary icon.
    *   Default: `white`
*   **`--min`**:
    *   Minimum size used for interactive elements like checkboxes, the submit button height, and the tooltip summary icon size.
    *   Default: `35px`
*   **`--font-size`**:
    *   Base font size for the component's content.
    *   Default: `small`

## Templating and Slots (`<a-consent>`)

You can customize the text content within the `<a-consent>` dialog by using the `slot` attribute on elements placed directly inside `<a-consent>`.

*   **`slot="title"`**: Replaces the main heading (Default: "**Data Consent**").
*   **`slot="description"`**: Replaces the introductory paragraph (Default: "Please allow us to store some cookies...").
*   **`slot="grant-all-label"`**: Replaces the label for the "Allow All" radio button (Default: "Allow All Cookies").
*   **`slot="grant-all-tooltip"`**: Replaces the text content inside the tooltip for "Allow All".
*   **`slot="deny-all-label"`**: Replaces the label for the "Necessary Only" radio button (Default: "Necessary Cookies Only").
*   **`slot="deny-all-tooltip"`**: Replaces the text content inside the tooltip for "Necessary Only".
*   **`slot="details-label"`**: Replaces the text for the collapsible "Details" summary (Default: "Details").
*   **`slot="analytics-label"`**: Replaces the label for the "Internal Analytics" checkbox (Default: "Internal Analytics").
*   **`slot="analytics-tooltip"`**: Replaces the text content inside the tooltip for "Internal Analytics".
*   **`slot="ad-tracking-label"`**: Replaces the label for the "Ad Tracking" checkbox (Default: "Ad Tracking").
*   **`slot="ad-tracking-tooltip"`**: Replaces the text content inside the tooltip for "Ad Tracking".
*   **`slot="ad-personalization-label"`**: Replaces the label for the "Ad Personalization" checkbox (Default: "Ad Personalization").
*   **`slot="ad-personalization-tooltip"`**: Replaces the text content inside the tooltip for "Ad Personalization".
*   **`slot="functionality-label"`**: Replaces the label for the "Necessary Cookies" checkbox (within details) (Default: "Necessary Cookies").
*   **`slot="functionality-tooltip"`**: Replaces the text content inside the tooltip for "Necessary Cookies".

## Slots (`<a-consent-edit>`)

*   **(Default Slot)**: Replaces the default link text (Default: "Change your cookie preferences.").

## Examples

### Example 1: Basic Setup with GA

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Site</title>
    <script>
        // REQUIRED for GA integration
        window.gtagTrackingId = 'G-YOURTRACKINGID';
    </script>
    <script type="module" src="a-consent.js"></script>
</head>
<body>
    <a-consent></a-consent>

    <h1>Welcome!</h1>
    <p>Page content...</p>

    <footer>
        <a-consent-edit>Manage Consent</a-consent-edit>
    </footer>
</body>
</html>
```

### Example 2: Customizing Appearance and Expiry

Set CSS variables and the `expire` attribute. Use the 'explode' effect.

```html
<head>
    <!-- GA ID and scripts -->
    <style>
        a-consent {
            --bg-color: #222;
            --text-color: #eee;
            --border-color: #555;
            --accent-color: limegreen;
            --accent-text: #000;
            --font-size: 1rem;
            position: fixed;
            left: 0;
            bottom: 0;
            width: 400px;
        }
    </style>
</head>
<body>
    <a-consent expire="180" effect="explode"></a-consent>
    <!-- content -->
</body>
```

### Example 3: Customizing Text with Slots

Override default labels and descriptions.

```html
<body>
    <a-consent>
        <h2 slot="title">Our Cookie Choices</h2>
        <p slot="description">
            We use cookies. Please review the options below and save your preferences.
            Read our full <a href="/privacy">privacy policy</a>.
        </p>
        <span slot="grant-all-label">Yes, enable all cookies</span>
        <span slot="deny-all-label">Only essential cookies</span>
        <span slot="analytics-label">Website Usage Stats</span>
        <!-- Add other slots as needed -->
    </a-consent>
    <!-- content -->
</body>
```

### Example 4: Setting Initial State and Required Functional Cookies

Default to `analytics` granted, and make `functional` cookies required.

```html
<body>
    <!-- Note: 'analytics' only sets the *initial* default -->
    <!-- 'functional="required"' makes it non-optional -->
    <a-consent analytics functional="required"></a-consent>
    <!-- content -->
</body>
```

## Special Notes

*   **GA/GTM Dependency:** The Google Analytics and GTM (Google Tag Manager) integration relies entirely on `window.gtagTrackingId` being defined *before* `a-consent.js` is executed. Without it, GA/GTM functions (`gtag(...)`) will not be called.
*   **Default Denied:** By default, and in compliance with GDPR, all consent types (`analytics_storage`, `ad_storage`, etc.) are set to `'denied'` initially when the `gtag.js` integration is active. They are only updated to `'granted'` after explicit user consent via this component.
*   **localStorage:** User preferences are stored in the browser's localStorage under the key `user_consent_preferences`. Clearing browser data will remove this, causing the banner to reappear.
*   **AConsentEdit:** The `<a-consent-edit>` component requires `<a-consent>` to be defined (which `a-consent.js` handles). It dynamically creates an `<a-consent>` instance inside a modal dialog when clicked.
