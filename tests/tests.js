import AConsent, { AConsentEdit } from '../src/a-consent.js';
import TestRunner from './ATestRunner.js';

const a = new TestRunner(null, '#tests');

// --- MOCKS ---
// Mock gtag function to track calls
let gtagMockCalls = [];
const mockGtag = function() {
  // console.log('mockGtag called with:', arguments); // For debugging tests
  gtagMockCalls.push(Array.from(arguments));
};

// Store original methods ONCE before any mocking happens
const originalLocalStorageMethods = {
    getItem: Storage.prototype.getItem,
    setItem: Storage.prototype.setItem,
    removeItem: Storage.prototype.removeItem,
    clear: Storage.prototype.clear,
};

// Mock localStorage for isolated testing
const mockLocalStorageInternal = (() => {
    let store = {};
    return {
        getItem: (key) => {
            // console.log(`Mock localStorage GET: ${key} -> ${store[key] || null}`);
            return store[key] || null;
        },
        setItem: (key, value) => {
            // console.log(`Mock localStorage SET: ${key} = ${value}`);
            store[key] = value.toString();
        },
        removeItem: (key) => {
            // console.log(`Mock localStorage REMOVE: ${key}`);
            delete store[key];
        },
        clear: () => {
            // console.log("Mock localStorage CLEAR");
            store = {};
        },
        getStore: () => store // Helper for checking content
    };
})();

// Function to apply the mock methods to Storage.prototype
const applyLocalStorageMock = () => {
    Storage.prototype.getItem = mockLocalStorageInternal.getItem;
    Storage.prototype.setItem = mockLocalStorageInternal.setItem;
    Storage.prototype.removeItem = mockLocalStorageInternal.removeItem;
    Storage.prototype.clear = mockLocalStorageInternal.clear;
};

// Function to restore the original methods
const restoreLocalStorage = () => {
    Storage.prototype.getItem = originalLocalStorageMethods.getItem;
    Storage.prototype.setItem = originalLocalStorageMethods.setItem;
    Storage.prototype.removeItem = originalLocalStorageMethods.removeItem;
    Storage.prototype.clear = originalLocalStorageMethods.clear;
};

// --- HELPER FUNCTIONS ---

const resetTestEnvironment = () => {
    // 1. Restore original localStorage methods first to clean up potential leftovers
    restoreLocalStorage();

    // 2. Reset other mocks and globals
    gtagMockCalls = [];
    window.gtag = undefined;
    window.dataLayer = undefined;
    window.gtagTrackingId = undefined;

    // 3. Apply the localStorage mock methods for the upcoming test
    applyLocalStorageMock();

    // 4. Clear the *mock's* internal store (now that Storage.prototype.clear points to the mock)
    localStorage.clear(); // This now calls mockLocalStorageInternal.clear()

    // 5. Remove any existing test elements
    document.body.querySelectorAll('a-consent, a-consent-edit').forEach(el => el.remove());

    // 6. Ensure components are defined (handle potential re-runs)
    if (!customElements.get('a-consent')) {
        customElements.define('a-consent', AConsent);
    }
    if (!customElements.get('a-consent-edit')) {
        customElements.define('a-consent-edit', AConsentEdit);
    }
};

const simulateGtagScriptLoad = () => {
    // ... (rest of simulateGtagScriptLoad remains the same, using mockGtag)
    if (window.gtagTrackingId) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = mockGtag; // Use our mock
        // gtag('js', new Date()); // We don't need to call the mock for this one in tests usually
        gtag('config', window.gtagTrackingId, { 'anonymize_ip': true });
        gtag(
            'consent',
            'default', {
                'analytics_storage': 'denied',
                'ad_storage': 'denied',
                'ad_user_data': 'denied',
                'ad_personalization': 'denied',
                'wait_for_update': 500
            }
        );
        a.info(`Simulated gtag setup for ID: ${window.gtagTrackingId}`);
    } else {
        a.info('Simulated gtag setup skipped (no window.gtagTrackingId)');
    }
};

// --- TEST SUITE ---

// --- gtag Initialization Tests ---
    a.info("--- Testing gtag Initialization ---");
    resetTestEnvironment(); // Reset includes applying the mock

    await a.test("gtag setup does nothing if window.gtagTrackingId is missing", !window.gtag && !window.dataLayer, true);

    // Set ID and simulate script execution
    window.gtagTrackingId = 'G-TEST12345';
    simulateGtagScriptLoad(); // Run the setup logic

    await a.test("window.dataLayer is created as an array", Array.isArray(window.dataLayer), true);
    await a.test("window.gtag is defined as a function", typeof window.gtag, 'function');
    // ... (rest of gtag tests remain the same) ...
    let consentDefaultCall = gtagMockCalls.find(call => call[0] === 'consent' && call[1] === 'default');
    await a.test("gtag 'consent default' sets ad_personalization to denied", consentDefaultCall && consentDefaultCall[2]?.ad_personalization, 'denied');


    // --- AConsent Component Tests ---
    a.info("--- Testing AConsent Component ---");

    // Test 1: Basic instantiation and default values

    resetTestEnvironment();
    let consentEl = document.createElement('a-consent');
    document.body.appendChild(consentEl);
    await a.delay(50);

    // ... (rest of Test 1 assertions remain the same) ...
    await a.test("AConsent: Functionality checkbox is disabled by default (as functional=required)", consentEl.shadowRoot.querySelector('#functionality-storage').disabled, true);
    consentEl.remove();

    // Test 2: Attribute setting affects properties

    resetTestEnvironment();
    consentEl = document.createElement('a-consent');
    // ... (rest of Test 2 setup and assertions remain the same) ...
    consentEl.remove();


    // Test 3: Interaction - Grant All

    resetTestEnvironment();
    window.gtagTrackingId = 'G-GRANTALL';
    simulateGtagScriptLoad();
    consentEl = document.createElement('a-consent');
    document.body.appendChild(consentEl);
    await a.delay(50);

    consentEl.shadowRoot.querySelector('#consent-all').click();
    await a.delay(50);
    // ... (Grant All interaction assertions) ...

    consentEl.shadowRoot.querySelector('#submit-input').click();
    await a.delay(500); // Allow submitChoices async + fade/explode

    // Grant All submission assertions - CHECKING THE MOCK LOCAL STORAGE NOW
    await a.test("AConsent Submit (Grant All): localStorage is set", !!localStorage.getItem(AConsent.storageKey), true); // Calls the mocked getItem
    let storedDataGrant = JSON.parse(localStorage.getItem(AConsent.storageKey) || '{}'); // Calls the mocked getItem
    await a.test("AConsent Submit (Grant All): localStorage has analytics_storage 'granted'", storedDataGrant.analytics_storage, 'granted');
    await a.test("AConsent Submit (Grant All): Element is removed after submit (fade effect)", !document.body.contains(consentEl), true);

    // Test 4: Interaction - Deny All

    resetTestEnvironment();
    window.gtagTrackingId = 'G-DENYALL';
    simulateGtagScriptLoad();
    consentEl = document.createElement('a-consent');
    consentEl.functional = false; // Make optional
    document.body.appendChild(consentEl);
    await a.delay(50);

    // ... (Deny All setup assertions) ...
    consentEl.shadowRoot.querySelector('#deny-all').click();
    await a.delay(50);

    // ... (Deny All interaction assertions) ...
    consentEl.shadowRoot.querySelector('#submit-input').click();
    await a.delay(500);

    // ... (Deny All submission assertions) ...
    await a.test("AConsent Submit (Deny All): localStorage is set", !!localStorage.getItem(AConsent.storageKey), true); // Mocked
    let storedDataDeny = JSON.parse(localStorage.getItem(AConsent.storageKey) || '{}'); // Mocked
    await a.test("AConsent Submit (Deny All): localStorage has analytics_storage 'denied'", storedDataDeny.analytics_storage, 'denied');
    await a.test("AConsent Submit (Deny All): Element is removed after submit", !document.body.contains(consentEl), true);


    // Test 5: Interaction - Custom Selection

    resetTestEnvironment();
    window.gtagTrackingId = 'G-CUSTOM';
    simulateGtagScriptLoad();
    consentEl = document.createElement('a-consent');
    document.body.appendChild(consentEl);
    await a.delay(50);

    // ... (Custom interaction assertions) ...
    consentEl.shadowRoot.querySelector('#analytics-storage').click();
    consentEl.shadowRoot.querySelector('#ad-personalization').click();
    await a.delay(50);
    // ...

    consentEl.shadowRoot.querySelector('#submit-input').click();
    await a.delay(500);

    // ... (Custom submission assertions) ...
    let storedDataCustom = JSON.parse(localStorage.getItem(AConsent.storageKey) || '{}'); // Mocked
    await a.test("AConsent Submit (Custom): localStorage has analytics_storage 'granted'", storedDataCustom.analytics_storage, 'granted');
    await a.test("AConsent Submit (Custom): localStorage has ad_personalization 'granted'", storedDataCustom.ad_personalization, 'granted');
    await a.test("AConsent Submit (Custom): Element is removed after submit", !document.body.contains(consentEl), true);


    // Test 6: Load from localStorage
    resetTestEnvironment();
    window.gtagTrackingId = 'G-LOADLS';
    simulateGtagScriptLoad();
    // Set localStorage *before* creating element using the mocked methods
    const savedPrefsLoad = {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        functionality_storage: 'granted',
        security_storage: 'granted',
        expiry: Date.now() + 1000 * 60 * 60 * 24 // Expires tomorrow
    };
    localStorage.setItem(AConsent.storageKey, JSON.stringify(savedPrefsLoad)); // Uses MOCKED setItem

    consentEl = document.createElement('a-consent');
    document.body.appendChild(consentEl);
    await a.delay(50);

    await a.test("AConsent Load: Element does not render UI when valid consent exists", consentEl.shadowRoot.innerHTML, '');
    consentEl.remove();
    // Check that the mock store still contains the item (it wasn't cleared by the component logic)
    await a.test("AConsent Load: Mock store still contains item after load", !!localStorage.getItem(AConsent.storageKey), true);


    // Test 7: Load from localStorage with `force` attribute
    resetTestEnvironment();
    window.gtagTrackingId = 'G-FORCE';
    simulateGtagScriptLoad();
    localStorage.setItem(AConsent.storageKey, JSON.stringify(savedPrefsLoad)); // Use same saved prefs via MOCKED setItem

    consentEl = document.createElement('a-consent');
    consentEl.force = true;
    document.body.appendChild(consentEl);
    await a.delay(50);

    // ... (Force load assertions remain the same) ...
    await a.test("AConsent Load (Force): Ad Tracking checkbox reflects saved 'denied'", consentEl.shadowRoot.querySelector('#ad-storage').checked, false);
    consentEl.remove();


    // --- AConsentEdit Component Tests ---
    a.info("--- Testing AConsentEdit Component ---");

    // Test 8: AConsentEdit basic setup and link click
    resetTestEnvironment();
    window.gtagTrackingId = 'G-EDIT';
    simulateGtagScriptLoad();
    let editEl = document.createElement('a-consent-edit');
    document.body.appendChild(editEl);
    await a.delay(50);

    // ... (Edit setup assertions) ...

    editEl.shadowRoot.querySelector('#edit-link').click();
    await a.delay(100);

    // ... (Edit interaction assertions) ...

    // Test 9: AConsentEdit close button
    // Continuing from Test 8 state
    editEl.shadowRoot.querySelector('#close').click();
    await a.delay(400);

    // ... (Edit close assertions) ...
    editEl.remove();


    // Test 10: AConsentEdit submitting inner form closes dialog
    resetTestEnvironment();
    window.gtagTrackingId = 'G-EDITSUBMIT';
    simulateGtagScriptLoad();
    // Pre-seed local storage to ensure the inner form reads something if needed
    localStorage.setItem(AConsent.storageKey, JSON.stringify({
        analytics_storage: 'denied', ad_storage: 'denied', // Initial state before edit
        ad_user_data: 'denied', ad_personalization: 'denied',
        functionality_storage: 'granted', security_storage: 'granted',
        expiry: Date.now() + 1000 * 60 * 60 * 24
    }));

    editEl = document.createElement('a-consent-edit');
    document.body.appendChild(editEl);
    await a.delay(50);

    editEl.shadowRoot.querySelector('#edit-link').click();
    await a.delay(100);

    let innerConsentElSubmit = editEl.shadowRoot.querySelector('dialog a-consent');
    await a.test("AConsentEdit Interaction (Submit): Inner consent exists", !!innerConsentElSubmit, true);

    // Simulate interaction within the inner form (e.g., grant analytics)
    innerConsentElSubmit.shadowRoot.querySelector('#analytics-storage').click();
    await a.delay(50);
    innerConsentElSubmit.shadowRoot.querySelector('#submit-input').click();
    await a.delay(400);

    // ... (Edit submission assertions) ...
    await a.test("AConsentEdit Interaction (Submit): localStorage was updated (analytics granted)", JSON.parse(localStorage.getItem(AConsent.storageKey) || '{}').analytics_storage, 'granted');

    editEl.remove();


    // --- END OF TESTS ---
    a.info("--- Consent Widget Tests Complete ---");

    // --- FINAL CLEANUP ---
    // Ensure original localStorage is restored regardless of test success/failure
    a.info("--- Restoring original localStorage ---");
    restoreLocalStorage();
