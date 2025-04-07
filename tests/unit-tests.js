// tests.js

// Wait for the DOM and custom elements to be ready
document.addEventListener('DOMContentLoaded', async () => {

  // Define AConsent and AConsentEdit if they aren't already
  // This assumes your original script exports them or makes them available globally
  // If they are in modules, you'd import them. For this setup, we'll assume
  // they are available after the original script runs. If not, you need to
  // manually include or define them here for testing purposes.

  // --- Test Setup ---
  const testContainer = document.getElementById('test-container');
  if (!testContainer) {
      console.error("Test container '#test-container' not found in HTML. Tests cannot run.");
      return;
  }

  // Helper to wait for microtasks (e.g., after setting attributes)
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const animationFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const shortDelay = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms)); // For transitions etc.

  // --- Mocks & Spies ---
  let gtagSpy;
  let consoleWarnSpy, consoleErrorSpy, consoleInfoSpy;
  let createElementSpy, getElementsByTagNameSpy, insertBeforeSpy, appendSpy;
  let windowLocationReloadSpy;
  let dateNowSpy; // For expiry testing

  // --- gtag Initialization Tests ---
  describe('gtag Initialization', () => {
    let gtagIdMock, dataLayerMock, gtagMock;
    let scriptElementMock;
    let firstScriptMock;
    let headMock;

    beforeEach(() => {
      // Reset mocks for each test
      dataLayerMock = undefined;
      gtagMock = undefined;
      gtagIdMock = undefined;

      // Mock document methods used in initialization
      scriptElementMock = { async: false, src: '', parentNode: null }; // Mock script element
      createElementSpy = createSpy(document, 'createElement').and.returnValue(scriptElementMock);

      // Mock script finding/insertion
      firstScriptMock = { parentNode: { insertBefore: () => {} } }; // Mock first script and its parent
      insertBeforeSpy = createSpy(firstScriptMock.parentNode, 'insertBefore');
      getElementsByTagNameSpy = createSpy(document, 'getElementsByTagName').and.returnValue([firstScriptMock]);

      headMock = { append: () => {} };
      appendSpy = createSpy(headMock, 'append');
      // Temporarily set document.head for testing insertion fallback
      Object.defineProperty(document, 'head', { value: headMock, configurable: true });

      // Mock console
      consoleWarnSpy = createSpy(console, 'warn');
      consoleInfoSpy = createSpy(console, 'info');
      consoleErrorSpy = createSpy(console, 'error');

      // Mock window properties (will be set in tests)
      // Use mockWindowProperty to handle cleanup automatically via restoreAllSpies
      mockWindowProperty('dataLayer', dataLayerMock);
      mockWindowProperty('gtag', gtagMock);
      mockWindowProperty('gtagTrackingId', gtagIdMock);
    });

    afterEach(() => {
        // Restore all spies and mocks created with createSpy or mock* methods
        TestRunner.restoreAllSpies();
         // Restore document.head if it was mocked
        Object.defineProperty(document, 'head', { value: document.querySelector('head'), configurable: true });
    });

     // --- Need to simulate script execution context ---
     // This is tricky. We'll evaluate the gtag part of the script manually within the test.
    async function runGtagScriptBlock() {
        // Extract the gtag initialization block from the original script text
        // This is fragile but avoids needing complex script loading simulation
        const scriptText = `
            if (window.gtagTrackingId) {
              window.dataLayer = window.dataLayer || [];
              window.gtag = function(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', window.gtagTrackingId, { 'anonymize_ip': true });

              // default values
              gtag(
                'consent',
                'default',
                {
                  'analytics_storage': 'denied',
                  'ad_storage': 'denied',
                  'ad_user_data': 'denied',
                  'ad_personalization': 'denied',
                  'wait_for_update': 500
                }
              );

              // --- Load the actual gtag.js script ---
                var gtagScript = document.createElement('script');
                gtagScript.async = true;
                gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(window.gtagTrackingId);

                var firstScript = document.getElementsByTagName('script')[0];
                if (firstScript && firstScript.parentNode) {
                  firstScript.parentNode.insertBefore(gtagScript, firstScript);
                  console.info('gtag.js script loaded for ID:', window.gtagTrackingId);
                } else {
                  var head = document.head; // Re-get head within this scope
                  if (head) {
                      head.append(gtagScript);
                      console.info('gtag.js script loaded for ID:', window.gtagTrackingId);
                  } else {
                      console.error('Could not find a place to insert the gtag.js script.');
                  }
                }
            } else {
              console.warn('Google Analytics Tracking ID (window.gtagTrackingId) is not defined. gtag will not be loaded.');
            }
        `;
        // Evaluate the script text in the current scope
        try {
            // Use Function constructor for safer evaluation than eval()
             new Function(scriptText)();
        } catch (e) {
            console.error("Error evaluating script block:", e);
        }
        await tick(); // Allow promises/async operations inside the script to settle
    }


    it('should initialize dataLayer and gtag function if gtagTrackingId is present', async () => {
        window.gtagTrackingId = 'UA-TEST-123';
        await runGtagScriptBlock();

        expect(window.dataLayer).toBeInstanceOf(Array);
        expect(typeof window.gtag).toBe('function');
    });

    it('should push initial events to dataLayer if gtagTrackingId is present', async () => {
        window.gtagTrackingId = 'UA-TEST-ID';
        await runGtagScriptBlock();

        expect(window.dataLayer.length).toBe(3); // js, config, consent default
        expect(window.dataLayer[0][0]).toBe('js');
        expect(window.dataLayer[0][1]).toBeInstanceOf(Date);
        expect(window.dataLayer[1][0]).toBe('config');
        expect(window.dataLayer[1][1]).toBe('UA-TEST-ID');
        expect(window.dataLayer[1][2]).toEqual({ 'anonymize_ip': true });
        expect(window.dataLayer[2][0]).toBe('consent');
        expect(window.dataLayer[2][1]).toBe('default');
        expect(window.dataLayer[2][2]).toEqual({
            'analytics_storage': 'denied',
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied',
            'wait_for_update': 500
        });
    });

    it('should attempt to create and insert the gtag script if gtagTrackingId is present', async () => {
        window.gtagTrackingId = 'UA-INSERT-TEST';
         await runGtagScriptBlock();

        expect(createElementSpy.callCount()).toBe(1);
        expect(createElementSpy.mostRecentCallArgs()).toEqual(['script']);
        expect(scriptElementMock.async).toBe(true);
        expect(scriptElementMock.src).toBe('https://www.googletagmanager.com/gtag/js?id=UA-INSERT-TEST');

        expect(getElementsByTagNameSpy.callCount()).toBe(1);
        expect(getElementsByTagNameSpy.mostRecentCallArgs()).toEqual(['script']);
        expect(insertBeforeSpy.callCount()).toBe(1);
        expect(insertBeforeSpy.mostRecentCallArgs()).toEqual([scriptElementMock, firstScriptMock]);
        expect(appendSpy.callCount()).toBe(0); // Should use insertBefore if firstScript exists
        expect(consoleInfoSpy.callCount()).toBe(1);
        expect(consoleInfoSpy.mostRecentCallArgs()[0]).toBe('gtag.js script loaded for ID:');
    });

     it('should attempt to append script to head if no other script tag found', async () => {
        window.gtagTrackingId = 'UA-APPEND-TEST';
        // Make getElementsByTagName return empty to simulate no scripts found
        getElementsByTagNameSpy.restore(); // Restore original first
        getElementsByTagNameSpy = createSpy(document, 'getElementsByTagName').and.returnValue([]);

        await runGtagScriptBlock();

        expect(createElementSpy.callCount()).toBe(1);
        expect(insertBeforeSpy.callCount()).toBe(0);
        expect(appendSpy.callCount()).toBe(1); // Should use append if firstScript doesn't exist but head does
        expect(appendSpy.mostRecentCallArgs()).toEqual([scriptElementMock]);
        expect(consoleInfoSpy.callCount()).toBe(1);
    });

     it('should log error if script cannot be inserted', async () => {
        window.gtagTrackingId = 'UA-FAIL-TEST';
        getElementsByTagNameSpy.restore();
        getElementsByTagNameSpy = createSpy(document, 'getElementsByTagName').and.returnValue([]); // No scripts
        // Mock document.head to be null
        Object.defineProperty(document, 'head', { value: null, configurable: true });

        await runGtagScriptBlock();

        expect(createElementSpy.callCount()).toBe(1);
        expect(insertBeforeSpy.callCount()).toBe(0);
        expect(appendSpy.callCount()).toBe(0); // Cannot append
        expect(consoleErrorSpy.callCount()).toBe(1);
        expect(consoleErrorSpy.mostRecentCallArgs()[0]).toBe('Could not find a place to insert the gtag.js script.');
    });


    it('should NOT initialize gtag and should warn if gtagTrackingId is missing', async () => {
        window.gtagTrackingId = undefined; // Ensure it's missing
        await runGtagScriptBlock();

        expect(window.dataLayer).toBeUndefined();
        expect(window.gtag).toBeUndefined();
        expect(createElementSpy.callCount()).toBe(0); // No script creation attempt
        expect(consoleWarnSpy.callCount()).toBe(1);
        expect(consoleWarnSpy.mostRecentCallArgs()[0]).toContain('window.gtagTrackingId) is not defined');
    });
});


  // --- AConsent Component Tests ---
  describe('AConsent Component', () => {
      let element;

      beforeEach(async () => {
          // Ensure AConsent is defined
          if (!customElements.get('a-consent')) {
               // This assumes AConsent is globally available or exported
              if (typeof AConsent !== 'undefined') {
                  customElements.define('a-consent', AConsent);
              } else {
                  throw new Error("AConsent class is not available to define.");
              }
          }
           // Reset mocks and spies
           TestRunner.restoreAllSpies();
           TestRunner.useMockLocalStorage(); // Use mock localStorage for each test
           gtagSpy = createSpy(window, 'gtag'); // Mock global gtag if potentially defined
           consoleWarnSpy = createSpy(console, 'warn');
           consoleErrorSpy = createSpy(console, 'error');
           consoleInfoSpy = createSpy(console, 'info');
           windowLocationReloadSpy = createSpy(window.location, 'reload');
           dateNowSpy = createSpy(Date, 'now');


          // Create and append element
          testContainer.innerHTML = ''; // Clear container
          element = document.createElement('a-consent');
          // Don't append yet, some tests might need attributes set first
      });

      afterEach(async () => {
          if (element && element.parentNode) {
              element.remove();
          }
          element = null;
          testContainer.innerHTML = '';
          TestRunner.restoreAllSpies();
          TestRunner.restoreLocalStorage();
          // Clear any global mocks if necessary
           if (window.gtag && window.gtag.restore) window.gtag.restore(); // Assuming spy adds restore
           window.gtag = undefined; // Clean up potentially defined gtag
      });

      it('should create an instance with a shadow root', () => {
          expect(element).toBeInstanceOf(HTMLElement);
          expect(element.shadowRoot).toBeTruthy();
          expect(element.shadowRoot.mode).toBe('open');
      });

      it('should render template content when connected and no saved consent exists', async () => {
          testContainer.appendChild(element);
          await tick(); // Wait for connectedCallback internal logic
          expect(element.shadowRoot.querySelector('form')).toBeTruthy();
          expect(element.shadowRoot.querySelector('#submit-input')).toBeTruthy();
          expect(element.shadowRoot.querySelector('#consent-all')).toBeTruthy();
           // Check if default slots are present
          expect(element.shadowRoot.querySelector('slot[name="title"]').assignedNodes().length).toBe(0); // No assigned node, but slot exists
           expect(element.shadowRoot.textContent).toContain('Data Consent'); // Check default slot content fallback
      });

       it('should NOT render template content if valid saved consent exists and force is false', async () => {
          // Simulate saved consent
           const consentData = {
              analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied',
              ad_personalization: 'denied', functionality_storage: 'granted', security_storage: 'granted',
              expiry: Date.now() + 100000 // Not expired
           };
           localStorage.setItem(AConsent.storageKey, JSON.stringify(consentData));

           element.force = false; // Ensure force is false (default)
           testContainer.appendChild(element);
           await tick();

           expect(element.shadowRoot.innerHTML).toBe(''); // Should be empty
           expect(element.form).toBeUndefined(); // Internal refs should not be set
      });

      it('should render template content if force attribute is true, even with saved consent', async () => {
           const consentData = { /* ... consent data ... */ expiry: Date.now() + 100000 };
           localStorage.setItem(AConsent.storageKey, JSON.stringify(consentData));

           element.setAttribute('force', 'true'); // Or element.force = true;
           testContainer.appendChild(element);
           await tick();

           expect(element.force).toBe(true);
           expect(element.shadowRoot.querySelector('form')).toBeTruthy(); // Should render
      });

      it('should render template content if saved consent is expired', async () => {
           const consentData = { /* ... consent data ... */ expiry: Date.now() - 100000 }; // Expired
           localStorage.setItem(AConsent.storageKey, JSON.stringify(consentData));

           testContainer.appendChild(element);
           await tick();

           expect(element.shadowRoot.querySelector('form')).toBeTruthy(); // Should render
           expect(localStorage.getItem(AConsent.storageKey)).toBeNull(); // Should remove expired item
      });

      it('should initialize checkbox states based on default attributes', async () => {
          // Set attributes before connecting
          element.setAttribute('analytics', 'true');
          element.setAttribute('ad-tracking', 'true');
          // ad-personalization defaults to false
           element.setAttribute('functional', 'true'); // Not required

          testContainer.appendChild(element);
          await tick();

          expect(element.analyticsInput.checked).toBe(true);
          expect(element.adTrackingInput.checked).toBe(true);
          expect(element.adPersonalizationInput.checked).toBe(false);
          expect(element.functionalityInput.checked).toBe(true);
          expect(element.functionalityInput.disabled).toBe(false); // Not required
      });

      it('should initialize checkbox states based on saved consent when force=true', async () => {
           const consentData = {
              analytics_storage: 'denied', ad_storage: 'granted', ad_user_data: 'granted',
              ad_personalization: 'granted', functionality_storage: 'denied', security_storage: 'denied',
              expiry: Date.now() + 100000
           };
           localStorage.setItem(AConsent.storageKey, JSON.stringify(consentData));

           element.force = true;
           testContainer.appendChild(element);
           await tick();

          expect(element.analyticsInput.checked).toBe(false);
          expect(element.adTrackingInput.checked).toBe(true);
          expect(element.adPersonalizationInput.checked).toBe(true);
          expect(element.functionalityInput.checked).toBe(false);
           expect(element.functionalityInput.disabled).toBe(false); // Not required in this saved data
      });

      it('should disable functionality checkbox if functional attribute is "required"', async () => {
           element.setAttribute('functional', 'required');
           testContainer.appendChild(element);
           await tick();

           expect(element.functional).toBe('required');
           expect(element.functionalityInput.checked).toBe(true);
           expect(element.functionalityInput.disabled).toBe(true);
      });

       it('should update properties when attributes change', async () => {
          testContainer.appendChild(element);
          await tick();

          expect(element.analytics).toBe(false); // Default
          element.setAttribute('analytics', 'true');
          // Attributes might take a microtask to reflect as properties via attributeChangedCallback
           await tick();
          expect(element.analytics).toBe(true);
          expect(element.analyticsInput.checked).toBe(true);

           element.setAttribute('ad-tracking', 'true');
           await tick();
           expect(element.adTracking).toBe(true);
           expect(element.adTrackingInput.checked).toBe(true);

          element.setAttribute('deny-all', 'true');
           await tick();
          expect(element.denyAll).toBe(true);
          expect(element.analytics).toBe(false); // denyAll should override others

           element.setAttribute('effect', 'explode');
           await tick();
           expect(element.effect).toBe('explode');

           element.setAttribute('expire', '180');
            await tick();
           expect(element.expire).toBe(180); // Note: expire setter has side effect on localStorage
      });

       // Test property setters directly
       it('should update internal state and inputs via property setters', async () => {
          testContainer.appendChild(element);
          await tick();

           element.analytics = true;
           expect(element.analytics).toBe(true);
           expect(element.analyticsInput.checked).toBe(true);
           element.analytics = false;
           expect(element.analytics).toBe(false);
           expect(element.analyticsInput.checked).toBe(false);

           element.adTracking = true;
           expect(element.adTracking).toBe(true);
           expect(element.adTrackingInput.checked).toBe(true);
           expect(element.choices().ad_user_data).toBe('granted'); // Check side effect

           element.adPersonalization = true;
           expect(element.adPersonalization).toBe(true);
           expect(element.adPersonalizationInput.checked).toBe(true);
           expect(element.choices().ad_user_data).toBe('granted');

           element.adTracking = false;
           element.adPersonalization = false;
           expect(element.adTracking).toBe(false);
           expect(element.adPersonalization).toBe(false);
           expect(element.choices().ad_user_data).toBe('denied'); // Should be denied now

           element.functional = 'required';
           expect(element.functional).toBe('required');
           expect(element.functionalityInput.checked).toBe(true);
           expect(element.functionalityInput.disabled).toBe(true);
           expect(element.choices().security_storage).toBe('granted'); // Linked to required functional

           element.functional = false;
           expect(element.functional).toBe(false);
           expect(element.functionalityInput.checked).toBe(false);
           expect(element.functionalityInput.disabled).toBe(false);
           expect(element.choices().security_storage).toBe('denied');
       });

      it('should handle "grantAll" property correctly', async () => {
          testContainer.appendChild(element);
          await tick();
          element.functional = true; // Ensure functional isn't 'required' for this test

          element.grantAll = true;
          expect(element.grantAll).toBe(true);
          expect(element.denyAll).toBe(false);
          expect(element.analytics).toBe(true);
          expect(element.adTracking).toBe(true);
          expect(element.adPersonalization).toBe(true);
          expect(element.functional).toBe(true); // Should be set to true if not required
          expect(element.choices().ad_user_data).toBe('granted');
          expect(element.choices().security_storage).toBe('granted');
      });

       it('should handle "denyAll" property correctly (functional=true)', async () => {
          testContainer.appendChild(element);
          await tick();
          element.functional = true; // Set functional to optional true initially

          element.denyAll = true;
          expect(element.denyAll).toBe(true);
          expect(element.grantAll).toBe(false);
          expect(element.analytics).toBe(false);
          expect(element.adTracking).toBe(false);
          expect(element.adPersonalization).toBe(false);
          expect(element.functional).toBe(false); // Should be set to false as it wasn't required
          expect(element.choices().ad_user_data).toBe('denied');
          expect(element.choices().security_storage).toBe('denied');
      });

      it('should handle "denyAll" property correctly (functional=required)', async () => {
          testContainer.appendChild(element);
          await tick();
          element.functional = 'required'; // Set functional to required

          element.denyAll = true;
          expect(element.denyAll).toBe(true);
          expect(element.grantAll).toBe(false);
          expect(element.analytics).toBe(false);
          expect(element.adTracking).toBe(false);
          expect(element.adPersonalization).toBe(false);
          expect(element.functional).toBe('required'); // Should remain required
          expect(element.choices().ad_user_data).toBe('denied');
          expect(element.choices().security_storage).toBe('granted'); // Security stays granted because functional is required
      });


      // Test processInput interactions
      describe('processInput method', () => {

          beforeEach(async () => {
              // Need element connected for inputs to exist
               testContainer.appendChild(element);
               await tick();
               // Reset state before each input test
               element.grantAll = false;
               element.denyAll = false;
               element.analytics = false;
               element.adTracking = false;
               element.adPersonalization = false;
               element.functional = true; // Set to non-required default
          });

          function simulateChange(inputElement) {
               inputElement.checked = !inputElement.checked; // Toggle state
              // Use trusted event if possible, otherwise fallback
               let event;
               try {
                  event = new Event('change', { bubbles: true, cancelable: true });
                  // Manually set isTrusted if needed for stricter checks, but often not possible.
                  // Testing the logic flow is usually sufficient.
               } catch (e) {
                  event = document.createEvent('Event');
                  event.initEvent('change', true, true);
               }
               inputElement.dispatchEvent(event);
               return event; // Return event if needed
          }

          it('should update state correctly when "consent-all" radio is checked', () => {
              simulateChange(element.grantAllInput);
              expect(element.analytics).toBe(true);
              expect(element.adTracking).toBe(true);
              expect(element.adPersonalization).toBe(true);
              expect(element.functional).toBe(true);
               expect(element.choices().ad_user_data).toBe('granted');
          });

          it('should update state correctly when "deny-all" radio is checked', () => {
               element.functional = true; // ensure not required
               simulateChange(element.denyAllInput);
               expect(element.analytics).toBe(false);
               expect(element.adTracking).toBe(false);
               expect(element.adPersonalization).toBe(false);
               expect(element.functional).toBe(false); // Should become false
               expect(element.choices().ad_user_data).toBe('denied');
          });

          it('should update state correctly when "analytics-storage" checkbox changes', () => {
               simulateChange(element.analyticsInput);
               expect(element.analytics).toBe(true);
               simulateChange(element.analyticsInput);
               expect(element.analytics).toBe(false);
          });

          it('should update adTracking and userDataStorage when "ad-storage" changes', () => {
              simulateChange(element.adTrackingInput); // Check it
               expect(element.adTracking).toBe(true);
               expect(element.choices().ad_user_data).toBe('granted');

              simulateChange(element.adTrackingInput); // Uncheck it
               expect(element.adTracking).toBe(false);
               expect(element.choices().ad_user_data).toBe('denied'); // Should deny if personalization is also off
          });

           it('should update adPersonalization and userDataStorage when "ad-personalization" changes', () => {
              simulateChange(element.adPersonalizationInput); // Check it
               expect(element.adPersonalization).toBe(true);
               expect(element.choices().ad_user_data).toBe('granted');

               simulateChange(element.adPersonalizationInput); // Uncheck it
               expect(element.adPersonalization).toBe(false);
               expect(element.choices().ad_user_data).toBe('denied'); // Should deny if tracking is also off
          });

          it('should keep userDataStorage granted if only one of adTracking/adPersonalization is unchecked', () => {
              simulateChange(element.adTrackingInput); // adTracking=true, userData=true
               simulateChange(element.adPersonalizationInput); // adPersonalization=true, userData=true
               expect(element.choices().ad_user_data).toBe('granted');

              simulateChange(element.adTrackingInput); // adTracking=false, userData should still be true
               expect(element.adTracking).toBe(false);
               expect(element.adPersonalization).toBe(true);
               expect(element.choices().ad_user_data).toBe('granted');

               simulateChange(element.adTrackingInput); // adTracking=true again
               simulateChange(element.adPersonalizationInput); // adPersonalization=false, userData should still be true
               expect(element.adTracking).toBe(true);
               expect(element.adPersonalization).toBe(false);
               expect(element.choices().ad_user_data).toBe('granted');
          });

           it('should uncheck radio buttons when a checkbox is changed', () => {
              simulateChange(element.grantAllInput); // Check grant all radio
              expect(element.grantAllInput.checked).toBe(true);

               simulateChange(element.analyticsInput); // Change a checkbox
               expect(element.grantAllInput.checked).toBe(false); // Grant all should be unchecked
               expect(element.denyAllInput.checked).toBe(false); // Deny all should be unchecked
           });

           it('should NOT change functional state if it is required', () => {
              element.functional = 'required';
               await tick(); // Allow update

               simulateChange(element.functionalityInput); // Try to uncheck
               expect(element.functional).toBe('required');
               expect(element.functionalityInput.checked).toBe(true); // Should remain checked and disabled

              // Try checking deny-all
              simulateChange(element.denyAllInput);
               expect(element.functional).toBe('required'); // Should remain required
               expect(element.functionalityInput.checked).toBe(true);
           });

          it('should throw TypeError if event is not an Event', () => {
              expect(() => element.processInput({})).toThrow(TypeError);
              expect(() => element.processInput(null)).toThrow(TypeError);
          });

           // Note: Testing event.isTrusted requires more complex event simulation, often skipped in basic unit tests.
           // We assume the browser handles this; we test the *logic* given a valid change event.
      });

      // Test choices() method
      it('choices() method should return the correct consent object structure', () => {
           element.analytics = true;
           element.adTracking = true; // This implies userDataStorage = true
           element.adPersonalization = false;
           element.functional = 'required'; // This implies securityStorage = true

           const choices = element.choices();

           expect(choices).toEqual({
              analytics_storage: 'granted',
              ad_storage: 'granted',
              ad_user_data: 'granted',
              ad_personalization: 'denied',
              functionality_storage: 'granted',
              security_storage: 'granted'
           });

           element.denyAll = true; // Deny all, functional required
           const choicesDenied = element.choices();
           expect(choicesDenied).toEqual({
               analytics_storage: 'denied',
               ad_storage: 'denied',
               ad_user_data: 'denied',
               ad_personalization: 'denied',
               functionality_storage: 'granted', // Because it's required
               security_storage: 'granted'  // Because functional is required
           });
      });

      // Test localStorage helpers indirectly via init/submit/reset
       describe('localStorage interaction', () => {
          const key = AConsent.storageKey;

           it('#localDataSet should store data with expiry', () => {
               const data = { analytics_storage: 'granted' };
               const days = 90;
               dateNowSpy.and.returnValue(1000000000000); // Mock Date.now() for predictable expiry

               element['#localDataSet'](key, data, days); // Access private method for isolated test (use bracket notation)

               const stored = localStorage.getItem(key);
               expect(stored).toBeTruthy();
               const parsed = JSON.parse(stored);
               expect(parsed.analytics_storage).toBe('granted');
               expect(parsed.expiry).toBe(1000000000000 + (days * 24 * 60 * 60 * 1000));
           });

           it('#localDataGet should retrieve non-expired data', () => {
               const expiry = Date.now() + 50000;
               const data = { ad_storage: 'denied', expiry: expiry };
               localStorage.setItem(key, JSON.stringify(data));

               const retrieved = element['#localDataGet'](key);
               expect(retrieved).toEqual(data);
           });

           it('#localDataGet should return null and remove expired data', () => {
               const expiry = Date.now() - 50000; // Expired
               const data = { ad_storage: 'denied', expiry: expiry };
               localStorage.setItem(key, JSON.stringify(data));

               const retrieved = element['#localDataGet'](key);
               expect(retrieved).toBeNull();
               expect(localStorage.getItem(key)).toBeNull(); // Should be removed
           });

          it('#localDataGet should return null for invalid JSON', () => {
               localStorage.setItem(key, "{invalid json");
               const retrieved = element['#localDataGet'](key);
               expect(retrieved).toBeNull();
               expect(localStorage.getItem(key)).toBeNull(); // Should remove invalid data
          });

           it('#localDataRemove should remove data', () => {
               localStorage.setItem(key, JSON.stringify({ test: 1 }));
               element['#localDataRemove'](key);
               expect(localStorage.getItem(key)).toBeNull();
           });

          it('resetConsent should remove data from localStorage and reload', () => {
               localStorage.setItem(key, JSON.stringify({ test: 1 }));
               element.resetConsent();
               expect(localStorage.getItem(key)).toBeNull();
               expect(windowLocationReloadSpy.callCount()).toBe(1);
           });

           it('expire setter should update expiry in localStorage if data exists', () => {
               const initialExpiry = Date.now() + 100000;
               const data = { analytics_storage: 'granted', expiry: initialExpiry };
               localStorage.setItem(key, JSON.stringify(data));

               dateNowSpy.and.returnValue(Date.now()); // Mock Date.now for setter calculation
               const newExpireDays = 180;
               element.expire = newExpireDays; // Use the setter

               const stored = localStorage.getItem(key);
               const parsed = JSON.parse(stored);
               const expectedNewExpiry = Date.now() + (newExpireDays * 24 * 60 * 60 * 1000);

               expect(parsed.expiry).toBe(expectedNewExpiry);
               expect(element.expire).toBe(newExpireDays); // Check property value as well
           });
       });

      // Test submitChoices and #updateConsent
       describe('submitChoices method', () => {
          let submitEvent;
           let fadeSpy, explodeSpy;

           beforeEach(async () => {
               testContainer.appendChild(element);
               await tick();
               // Mock effects
               fadeSpy = createSpy(element, 'fadeElement');
               explodeSpy = createSpy(element, 'explodeElement').and.callFake(() => Promise.resolve()); // Mock promise resolution
               // Spy on private method indirectly via public caller or direct access if needed
               // createSpy(element, '#updateConsent') won't work. Test via submitChoices side effects.

               // Create a trusted-like event
               submitEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
               // Cannot set isTrusted directly in most browsers, test logic flow.
           });

           it('should prevent default form submission', async () => {
               const preventDefaultSpy = createSpy(submitEvent, 'preventDefault');
               await element.submitChoices(submitEvent);
               expect(preventDefaultSpy.callCount()).toBe(1);
           });

          it('should call gtag("consent", "update", ...) with current choices', async () => {
              element.analytics = true;
              element.adTracking = false;
               const currentChoices = element.choices();

               await element.submitChoices(submitEvent);

               expect(gtagSpy.callCount()).toBe(1);
               expect(gtagSpy.mostRecentCallArgs()[0]).toBe('consent');
               expect(gtagSpy.mostRecentCallArgs()[1]).toBe('update');
               expect(gtagSpy.mostRecentCallArgs()[2]).toEqual(currentChoices);
           });

           it('should save choices to localStorage', async () => {
               element.analytics = true;
               const currentChoices = element.choices();
               const days = element.expire; // Get current expire value
               dateNowSpy.and.returnValue(Date.now()); // Mock date for expiry calculation

              await element.submitChoices(submitEvent);

              const stored = localStorage.getItem(AConsent.storageKey);
              expect(stored).toBeTruthy();
              const parsed = JSON.parse(stored);
              expect(parsed.analytics_storage).toBe('granted');
              // Check if expiry was added correctly
              expect(parsed.expiry).toBe(Date.now() + (days * 24 * 60 * 60 * 1000));
           });

           it('should call fadeElement by default', async () => {
               element.effect = 'fade'; // Ensure default or set explicitly
               await element.submitChoices(submitEvent);
               expect(fadeSpy.callCount()).toBe(1);
               expect(explodeSpy.callCount()).toBe(0);
           });

           it('should call explodeElement if effect is "explode"', async () => {
               element.effect = 'explode';
               await element.submitChoices(submitEvent);
               expect(fadeSpy.callCount()).toBe(0);
               expect(explodeSpy.callCount()).toBe(1);
                // Check if element is removed after explode (explode mock should handle this conceptually)
               await shortDelay(10); // Allow promise in submitChoices to resolve
               expect(element.parentNode).toBeNull(); // Explode should remove element eventually
           });

            it('should close dialog if inside one (simulated)', async () => {
               // Simulate being inside a dialog and part of a-consent-edit
               const mockDialog = document.createElement('dialog');
               const mockConsentEdit = { localName: 'a-consent-edit', hideForm: () => {} };
               const hideFormSpy = createSpy(mockConsentEdit, 'hideForm');
               const mockShadowRoot = { host: mockConsentEdit }; // Mock shadow root of a-consent

              // Temporarily mock getRootNode and closest
              const getRootNodeSpy = createSpy(element, 'getRootNode').and.returnValue(mockShadowRoot);
              const closestSpy = createSpy(element, 'closest').and.returnValue(mockDialog);

               await element.submitChoices(submitEvent);

               expect(hideFormSpy.callCount()).toBe(1); // Check if hideForm was called on the host

               getRootNodeSpy.restore();
               closestSpy.restore();
           });

           it('should throw TypeError if event is not an Event', async () => {
               // Cannot use expect().toThrow directly with async function easily in vanilla
              let thrown = false;
               try {
                   await element.submitChoices({});
               } catch (e) {
                   thrown = e instanceof TypeError;
               }
               expect(thrown).toBe(true);
           });
       });

      // Test disconnectedCallback
       it('disconnectedCallback should abort the controller', async () => {
          testContainer.appendChild(element);
           await tick();
           const abortSpy = createSpy(element.abortController, 'abort');
           element.remove(); // Trigger disconnectedCallback
           await tick(); // Allow microtasks
           expect(abortSpy.callCount()).toBe(1);
       });

       // Note: Testing fadeElement and explodeElement visually requires integration/e2e tests.
       // Unit tests can check if they are called (done in submitChoices tests)
       // or test their internal logic if separated (e.g., check style changes, setTimeout calls).
       // Testing them fully here is complex without visual regression or more DOM mocking.
        it('fadeElement should set opacity and add listener (mocked)', async () => {
          testContainer.appendChild(element);
          await tick();
          const addListenerSpy = createSpy(element, 'addEventListener');
          const removeSpy = createSpy(element, 'remove'); // Spy on remove

          element.fadeElement(element);

           expect(element.style.opacity).toBe('0');
           expect(addListenerSpy.callCount()).toBe(1);
           expect(addListenerSpy.mostRecentCallArgs()[0]).toBe('transitionend');

           // Simulate transition end
           const callback = addListenerSpy.mostRecentCallArgs()[1];
           callback(); // Manually call the listener callback

           expect(removeSpy.callCount()).toBe(1); // Element should be removed
       });

  });

   // --- AConsentEdit Component Tests ---
  describe('AConsentEdit Component', () => {
      let editElement;
      let dialogMock;
      let showModalSpy, closeSpy;
      let linkElement, closeButtonElement;

      beforeEach(async () => {
           // Ensure AConsentEdit is defined
           if (!customElements.get('a-consent-edit')) {
               if (typeof AConsentEdit !== 'undefined') {
                  customElements.define('a-consent-edit', AConsentEdit);
               } else {
                  throw new Error("AConsentEdit class is not available to define.");
               }
           }
           // Ensure AConsent is also defined for creation within AConsentEdit
           if (!customElements.get('a-consent')) {
                if (typeof AConsent !== 'undefined') {
                  customElements.define('a-consent', AConsent);
               } else {
                   throw new Error("AConsent class is not available to define.");
               }
           }

           TestRunner.restoreAllSpies();
           consoleErrorSpy = createSpy(console, 'error'); // Spy on errors

           // Wait for a-consent definition if tests depend on it being available immediately in connectedCallback
           // In practice, AConsentEdit waits internally, so direct testing after append might be okay.
            await customElements.whenDefined('a-consent');

           testContainer.innerHTML = ''; // Clear container
           editElement = document.createElement('a-consent-edit');
           testContainer.appendChild(editElement);

           // Wait for AConsentEdit's connectedCallback to potentially finish (it waits for a-consent)
           await tick(); // Allow microtasks
           await shortDelay(5); // Small delay just in case connectedCallback has async parts

          // Access shadow DOM elements *after* connectedCallback has likely run
          linkElement = editElement.shadowRoot.querySelector('#edit-link');
          dialogMock = editElement.shadowRoot.querySelector('dialog#edit-dialog');
          closeButtonElement = editElement.shadowRoot.querySelector('#close');

           if (!dialogMock || !linkElement || !closeButtonElement) {
               throw new Error("AConsentEdit failed to render essential elements in shadow DOM.");
           }

          // Mock dialog methods
          showModalSpy = createSpy(dialogMock, 'showModal');
          closeSpy = createSpy(dialogMock, 'close');
       });

      afterEach(() => {
          if (editElement && editElement.parentNode) {
              editElement.remove(); // Triggers disconnect
          }
           editElement = null;
           testContainer.innerHTML = '';
          TestRunner.restoreAllSpies();
      });

      it('should create an instance with shadow root', () => {
          expect(editElement).toBeInstanceOf(HTMLElement);
          expect(editElement.shadowRoot).toBeTruthy();
      });

      it('should render the template with link and dialog', () => {
          expect(linkElement).toBeTruthy();
          expect(dialogMock).toBeTruthy();
          expect(closeButtonElement).toBeTruthy();
           expect(linkElement.textContent).toContain('Change your data-consent preferences'); // Default slot
      });

      it('showForm should prevent default event action', () => {
           const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
           const preventDefaultSpy = createSpy(clickEvent, 'preventDefault');
           linkElement.dispatchEvent(clickEvent); // Simulate click
           expect(preventDefaultSpy.callCount()).toBe(1);
      });

      it('showForm should call dialog.showModal()', async () => {
          linkElement.click(); // Use direct click helper
           await tick(); // Allow event handling and potential async ops in showForm
          expect(showModalSpy.callCount()).toBe(1);
          expect(dialogMock.open).toBe(true); // Check dialog state if mock doesn't handle it
      });

       it('showForm should create and append an a-consent element to the dialog', async () => {
          linkElement.click();
          await tick();
          const consentElement = dialogMock.querySelector('a-consent');
          expect(consentElement).toBeTruthy();
          expect(consentElement).toBeInstanceOf(customElements.get('a-consent'));
          expect(dialogMock.contains(consentElement)).toBe(true);
       });

       it('showForm should set force=true on the created a-consent element', async () => {
           linkElement.click();
           await tick();
           const consentElement = dialogMock.querySelector('a-consent');
           expect(consentElement.force).toBe(true);
       });

      it('showForm should remove fade class for fade-in effect', async () => {
          expect(dialogMock.classList.contains('fade')).toBe(true); // Starts with fade
          linkElement.click();
          // Wait for requestAnimationFrame inside showForm
          await animationFrame();
          expect(dialogMock.classList.contains('fade')).toBe(false);
      });

      it('showForm should not do anything if dialog is already open', async () => {
          dialogMock.open = true; // Manually set open state
          linkElement.click();
           await tick();
           // showModal should NOT be called again if already open
           expect(showModalSpy.callCount()).toBe(0);
           // Check that only one consent form exists if clicked multiple times while open
           const consentForms = dialogMock.querySelectorAll('a-consent');
           expect(consentForms.length).toBe(1); // Should not add another one
      });

      it('hideForm should add fade class and eventually call dialog.close()', async () => {
          // First, open it
           linkElement.click();
           await animationFrame(); // Wait for fade-in complete
           expect(dialogMock.classList.contains('fade')).toBe(false);
           expect(dialogMock.open).toBe(true);

          // Now, close it via button
          closeButtonElement.click();
           await tick(); // Allow hideForm logic to start

           expect(dialogMock.classList.contains('fade')).toBe(true); // Fade out class added

           // Simulate transition end
           dialogMock.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' }));
           await shortDelay(10); // Allow listener callback and microtasks

           expect(closeSpy.callCount()).toBe(1);
           expect(dialogMock.open).toBe(false);
      });

       it('hideForm should remove the a-consent element after closing', async () => {
           linkElement.click();
           await animationFrame();
           expect(dialogMock.querySelector('a-consent')).toBeTruthy();

           closeButtonElement.click();
           dialogMock.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' }));
           await shortDelay(10);

           expect(dialogMock.querySelector('a-consent')).toBeNull(); // Should be removed
           expect(editElement.consentForm).toBeNull(); // Internal reference should be cleared
       });

      it('clicking dialog backdrop should call hideForm', async () => {
          linkElement.click();
           await animationFrame(); // Open dialog

          const hideFormSpy = createSpy(editElement, 'hideForm');

          // Simulate clicking the dialog element itself (like clicking backdrop)
          dialogMock.dispatchEvent(new MouseEvent('click', { bubbles: true }));
           await tick();

          expect(hideFormSpy.callCount()).toBe(1);
      });

       it('clicking inside dialog content should NOT call hideForm', async () => {
           linkElement.click();
           await animationFrame(); // Open dialog

          const hideFormSpy = createSpy(editElement, 'hideForm');
          const consentForm = dialogMock.querySelector('a-consent');

          // Simulate clicking the consent form inside the dialog
          consentForm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
           await tick();

          expect(hideFormSpy.callCount()).toBe(0); // Should not close
       });


      it('disconnectedCallback should abort controller and close dialog if open', async () => {
           linkElement.click(); // Open the dialog
           await animationFrame();
           expect(dialogMock.open).toBe(true);

          const abortSpy = createSpy(editElement.abortController, 'abort');
          editElement.remove(); // Trigger disconnectedCallback
           await tick(); // Allow microtasks

          expect(abortSpy.callCount()).toBe(1);
          // Check if close was called (mocked close method)
          expect(closeSpy.callCount()).toBe(1);
           expect(editElement.consentForm).toBeNull(); // Should clean up consent form reference
       });
  });


  // --- Run all defined tests ---
  TestRunner.runTests();

}); // End DOMContentLoaded
