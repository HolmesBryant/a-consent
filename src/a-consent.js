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
      'analytics_storage': 'denied',      // Google Analytics
      'ad_storage': 'denied',             // Google Ads
      'ad_user_data': 'denied',           // Controls sending user data to Google for ads
      'ad_personalization': 'denied',     // Controls personalized advertising (retargeting)
      'wait_for_update': 500              // Milliseconds to wait for consent update before using defaults
    }
  );

  // --- Load the actual gtag.js script ---
    var gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(window.gtagTrackingId);

    // Find the first script tag on the page
    var firstScript = document.getElementsByTagName('script')[0];
    // Insert the new gtag script before the first script tag
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(gtagScript, firstScript);
      console.info('gtag.js script loaded for ID:', window.gtagTrackingId);
    } else {
      // If no script tag is found append to head
      if (head) {
          document.head.append(gtagScript);
          console.info('gtag.js script loaded for ID:', window.gtagTrackingId);
      } else {
          console.error('Could not find a place to insert the gtag.js script.');
      }
    }
} else {
  console.warn('Google Analytics Tracking ID (window.gtagTrackingId) is not defined. gtag will not be loaded.');
}

/**
 *@class AConsent
 * @extends HTMLElement
 * @description A custom element for displaying a dialog allowing the user to consent/deny permission to use their data for analytics/advertising purposes.
 * @author Holmes Bryant <https://github.com/HolmesBryant>
 * @license GPL-3.0
 *
 */

export default class AConsent extends HTMLElement {

  //////// ATTRIBUTES ////////

  /**
   * @description Whether ad_personalization is granted
   * @type {boolean}
   */
  #adPersonalization = false;

  /**
   * @description Whether ad_storage is granted
   * @type {boolean}
   */
  #adTracking = false;

  /**
   * @description Whether analytics_storage is granted
   * @type {boolean}
   */
  #analytics = false;

  /**
   * @description Whether all permissions are denied
   * @type {boolean}
   */
  #denyAll = false;

  /**
   * @description What to do when user submits the form
   * @type {'fade'|'explode'}
   */
  #effect = 'fade';

  /**
   * @private
   * @description How many days to store user consent choices
   * @type {number}
   */
  #expire = 365;

  /**
   * @description Whether functionality_storage is granted
   * @type {boolean | string}
   */
  #functional = true;

  /**
   * @description Whether all permissions are granted
   * @type {boolean}
   */
  #grantAll = false;

  /**
   * @description Whether security_storage is granted
   * @type {boolean}
   */
  #securityStorage = true;

  /**
   * @description Whether ad_user_data is granted
   * @type {boolean}
   */
  #userDataStorage = false;

  //////// PROPERTIES ////////

  /**
   * @description An abort controller for easily removing all event listeners
   * @type {AbortController}
   */
  abortController = new AbortController();

  /**
   * @description The checkbox for consenting to storing analytics data
   * @type {HTMLInputElement}
   */
  analyticsInput;

  /**
   * @description The checkbox for consenting to storing and sharing user data for analyzing ad campaigns
   * @type {HTMLInputElement}
   */
  adTrackingInput;

  /**
   * @description The checkbox for consenting to storing user data for ad personalization
   * @type {HTMLInputElement}
   */
  addPersonalizationInput;

  /**
   * @description The checkbox for denying permission to store or share any user data
   * @type {HTMLInputElement}
   */
  denyAllInput;

  /**
   * @description How long to keep the cookie, ie. how long to remember the consent
   * @type {number}
   */
  expire = 365;

  /**
   * @description Whether to force the display of the consent form (even if previously submitted). This is necessary to allow the user to change their preferences later.
   * @type {boolean}
   */
  force = false;

  /**
   * @description The checkbox for consenting to storing user data for proper site functionality
   * @type {HTMLInputElement}
   */
  functionalityInput;

  /**
   * @description The checkbox for consenting to storing and sharing all user data
   * @type {HTMLInputElement}
   */
  grantAllInput;

  /**
   * @description Consent data retrieved from localStorage, if any;
   * @type {object}
   */
  savedConsent;

  static observedAttributes = [
    'analytics',
    'ad-tracking',
    'ad-personalization',
    'deny-all',
    'effect',
    'expire',
    'functional' ,
    'grant-all'
  ];

  /**
   * @description The name of the localStorage key with which to store consent choices
   * @type {string}
   */
  static storageKey = 'user_consent_preferences';

  /**
   * @description The template used to render the html consent dialog
   * @type {string}
   */
  static template = `
    <style>
      :host {
        --bg-color: hsl(0, 0%, 95%);
        --text-color: hsl(0, 0%, 15%);
        --border-color: hsl(0, 0%, 75%);
        --accent-color: dodgerblue;
        --accent-text: white;
        --min: 35px;
        --font-size: small;

        display: block;
        font-size: var(--font-size);
        max-width: 100%;
        opacity: 1;
        width: max-content;
        transition: opacity .3s ease-out;
      }

      input:disabled {
        cursor: not-allowed;
        opacity: 0.9;
      }

      label {
        cursor: pointer;
      }

      main {
        background: var(--bg-color);
        border: 1px solid var(--border-color);
        border-radius: 10px;
        color: var(--text-color);
        padding: 1rem;
      }

      summary {
        cursor: pointer;
      }

      .row {
        align-items: center;
        display: flex;
        gap: 1rem;
        justify-content: space-between;
        position: relative;
      }

      .row.left {
        justify-content: start;
      }

      .row input {
        width: var(--min);
        height: var(--min);
      }

      .tooltip div {
        background: var(--bg-color);
        border: 1px solid var(--bg-color);
        left: 0;
        padding: 0;
        position: absolute;
        width: calc(100% - 75px);
        z-index: -1;
      }

      .tooltip[open] div {
        box-shadow: 4px 4px 10px black;
        bottom: 0;
        padding: 1rem;
        z-index: 1;
      }

      .tooltip summary {
        align-items: center;
        box-sizing: border-box;
        justify-content: center;
        background: none;
        border: 1px solid var(--border-color);
        border-radius: 50%;
        display: flex;
        font-size: var(--min);
        font-weight: bold;
        height: var(--min);
        width: var(--min);
      }

      .tooltip summary:hover {
        box-shadow: 1px 1px 2px black;
      }

      .tooltip summary:active {
        box-shadow: inset 2px 2px 5px black;
      }

      .tooltip[open] summary {
        background: var(--accent-color);
        box-shadow: inset 2px 2px 5px black;
        color: var(--accent-text);
      }

      .tooltip summary::marker {
        content: "";
      }

      #submit-input {
        background: var(--accent-color);
        border: 1px solid var(--border-color);
        border-radius: 3px;
        color: var(--accent-text);
        cursor: pointer;
        min-height: var(--min);
        width: 100%;
      }

      #submit-input:hover {
        box-shadow: 2px 2px 5px black;
      }

      #submit-input:active {
        background: unset;
        color: unset;
        box-shadow: inset 2px 2px 5px black;
      }
    </style>

    <main>
      <slot name="title"><strong>Data Consent</strong></slot>
      <slot name="description">
        <p>Please allow us to store some cookies on your computer as outlined in our privacy policy.</p>
      </slot>

      <form onsubmit="return false">
        <div class="row">
            <input type="radio" name="accept-deny-all" id="consent-all">
            <label for="consent-all">
              <slot name="grant-all-label">Allow All Cookies</slot>
            </label>
            <details class="tooltip">
              <summary aria-label="more info">?</summary>
              <div>
                <slot name="grant-all-tooltip">
                  Accept storage and disclosing of data for: necessary cookies, analytics, advertising and ad personalization.
                </slot>
              </div>
            </details>
        </div>
        <div class="row">
            <input type="radio" name="accept-deny-all" id="deny-all">
            <label for="deny-all">
              <slot name="deny-all-label">Necessary Cookies Only</slot>
            </label>
            <details class="tooltip">
              <summary aria-label="more info">?</summary>
              <div>
                <slot name="deny-all-tooltip">
                  Deny consent to store or use any data except that which is needed to perform essential services such as session cookies, shopping cart cookies or security cookies.
                </slot>
              </div>
            </details>
        </div>

        <hr>
          <button type="submit" id="submit-input">Submit</button>
        <hr>

        <details>
          <summary>
            <slot name="details-label">Details</slot>
          </summary>
          <div class="row">
            <input type="checkbox" id="analytics-storage">
            <label for="analytics-storage">
              <slot name="analytics-label">Internal Analytics</slot>
            </label>
            <details class="tooltip">
              <summary aria-label="more info">?</summary>
              <div>
                <slot name="analytics-tooltip">
                   Data that allows us to count visits and traffic sources so we can measure and improve the performance of our site.
                </slot>
              </div>
            </details>
          </div>

          <div class="row">
            <input type="checkbox" id="ad-storage">
            <label>
              <slot name="ad-tracking-label">Ad Tracking</slot>
            </label>
            <details class="tooltip">
              <summary aria-label="more info">?</summary>
              <div>
                <slot name="ad-tracking-tooltip">
                  Data gathered for the purpose of measuring the success or failure of our public outreach and advertising efforts.
                </slot>
              </div>
            </details>
          </div>

          <div class="row">
            <input type="checkbox" id="ad-personalization">
            <label>
              <slot name="ad-personalization-label">Ad Personalization</slot>
            </label>
            <details class="tooltip">
              <summary aria-label="more info">?</summary>
              <div>
                <slot name="ad-personalization-tooltip">
                  Data gathered for the purpose of personalizing ads. This helps Google choose ads for products and services that better match your interests.
                </slot>
              </div>
            </details>
          </div>

          <div class="row">
            <input type="checkbox" id="functionality-storage">
            <label>
              <slot name="functionality-label">Necessary Cookies</slot>
            </label>
            <details class="tooltip">
              <summary aria-label="more info">?</summary>
              <div>
                <slot name="functionality-tooltip">
                  Cookies needed to perform essential functions such as session cookies, shopping cart cookies or security cookies.
                </slot>
              </div>
            </details>
          </div>

        </details>
      </form>
    </main>
  `;

  /**
   * @constructor
   */
  constructor() {
    super();
    this.attachShadow({mode:'open'});
  }

  /**
   * @description Lifecycle callback for custom element
   */
  connectedCallback() {
    this.savedConsent = this.#localDataGet(AConsent.storageKey);
    if (this.abortController.signal.aborted) this.abortController = new AbortController();
    if (!this.savedConsent || this.force) {
      this.shadowRoot.innerHTML = AConsent.template;
      this.form = this.shadowRoot.querySelector('form');
      this.submitInput = this.shadowRoot.querySelector('#submit-input');
      this.grantAllInput = this.shadowRoot.querySelector('#consent-all');
      this.denyAllInput = this.shadowRoot.querySelector('#deny-all');
      this.analyticsInput = this.shadowRoot.querySelector('#analytics-storage');
      this.adTrackingInput = this.shadowRoot.querySelector('#ad-storage');
      this.adPersonalizationInput = this.shadowRoot.querySelector('#ad-personalization');
      this.functionalityInput = this.shadowRoot.querySelector('#functionality-storage');

      this.grantAllInput.addEventListener('change', this.processInput.bind(this), {signal: this.abortController.signal});
      this.denyAllInput.addEventListener('change', this.processInput.bind(this), {signal: this.abortController.signal});
      this.analyticsInput.addEventListener('change', this.processInput.bind(this), {signal: this.abortController.signal});
      this.adTrackingInput.addEventListener('change', this.processInput.bind(this), {signal: this.abortController.signal});
      this.adPersonalizationInput.addEventListener('change', this.processInput.bind(this), {signal: this.abortController.signal});
      this.functionalityInput.addEventListener('change', this.processInput.bind(this), {signal: this.abortController.signal});
      this.submitInput.addEventListener('click', this.submitChoices.bind(this), {signal: this.abortController.signal});
      this.init();
    }
  }

  /**
   * @function attributeChangedCallback
   * @description Called when an attribute of the element is changed.
   * @param {string} attr - The name of the attribute that changed.
   * @param {*} oldval - The old value of the attribute.
   * @param {*} newval - The new value of the attribute.
   */
  attributeChangedCallback(attr, oldval, newval) {
    attr = attr.replace(/-(.)/g, (match, letter) => letter.toUpperCase());
    this[attr] = newval;
  }

  disconnectedCallback() {
    this.abortController.abort();
  }

  choices() {
    return {
      analytics_storage: this.analytics ? 'granted' : 'denied',
      ad_storage: this.adTracking ? 'granted' : 'denied',
      ad_user_data: this.#userDataStorage  ? 'granted' : 'denied',
      ad_personalization: this.adPersonalization  ? 'granted' : 'denied',
      functionality_storage: (this.functional === true || this.functional === 'required')  ? 'granted' : 'denied',
      security_storage: this.#securityStorage  ? 'granted' : 'denied'
    }
  }

  /**
   * Creates a visual "explosion" effect for a DOM element using multicolored dots,
   * then removes the original element.
   *
   * @param {HTMLElement} element The DOM element to explode.
   * @param {object} [options={}] Configuration options.
   * @param {number} [options.particleCount=50] Number of dots to create.
   * @param {number} [options.dotSize=5] Size of each dot in pixels.
   * @param {number} [options.duration=800] Duration of the explosion animation in milliseconds.
   * @param {number} [options.explosionRadius=150] Maximum distance particles travel from the center.
   * @param {string} [options.easing='ease-out'] CSS easing function for the animation.
   * @param {number} [options.zIndex=9999] z-index for the particles.
   * @returns {Promise<void>} A promise that resolves when the animation is complete and the element is removed.
   */
  explodeElement(element, options = {}) {
    if (!element || !(element instanceof HTMLElement)) {
      return Promise.reject("Invalid element.");
    }

    const defaults = {
      particleCount: 50,
      dotSize: 100,       // pixels
      duration: 500,    // milliseconds
      explosionRadius: 200, // pixels
      easing: 'ease-out',
      zIndex: 9999
    };

    const config = { ...defaults, ...options };

    function getRandomColor() {
      // Simple random hex color
      return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    }

    return new Promise((resolve) => {
      const rect = element.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      // Calculate element's center position relative to the document
      const centerX = rect.left + scrollX + rect.width / 2;
      const centerY = rect.top + scrollY + rect.height / 2;

      const particles = [];

      element.style.transition = `opacity ${config.duration / 4}ms ease-in`;

      // Create particles
      for (let i = 0; i < config.particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.left = `${centerX - config.dotSize / 2}px`;
        particle.style.top = `${centerY - config.dotSize / 2}px`;
        particle.style.width = `${config.dotSize}px`;
        particle.style.height = `${config.dotSize}px`;
        particle.style.borderRadius = '50%';
        particle.style.backgroundColor = getRandomColor();
        particle.style.zIndex = String(config.zIndex);
        particle.style.pointerEvents = 'none'; // Prevent interaction
        particle.style.opacity = '1';
        particle.style.transition = `transform ${config.duration}ms ${config.easing}, opacity ${config.duration}ms ${config.easing}`;

        // Initial transform (at the center)
        particle.style.transform = 'translate(0, 0) scale(1)';

        document.body.appendChild(particle);
        particles.push(particle);
      }

      // Animate particles outwards
      // Use requestAnimationFrame to ensure initial styles are applied before transition starts
      requestAnimationFrame(() => {
        // Hide the original element immediately but keep its space for layout
        element.style.visibility = 'hidden';
        for (const particle of particles) {
          const angle = Math.random() * 2 * Math.PI; // Random direction
          const distance = Math.random() * config.explosionRadius; // Random distance

          const translateX = Math.cos(angle) * distance;
          const translateY = Math.sin(angle) * distance;

          // Apply final state for transition
          particle.style.transform = `translate(${translateX}px, ${translateY}px) scale(0)`; // Move and shrink
          particle.style.opacity = '0';
        }
      });

      // Clean up
      setTimeout(() => {
        for (const particle of particles) {
          particle.remove();
        }

        resolve();
      }, config.duration);

    });
  }

  fadeElement(element) {
    const abortController = new AbortController();
    element.style.opacity = 0;
    element.addEventListener('transitionend', event => {
      abortController.abort();
      element.remove();
    }, {signal: abortController.signal});
  }

  init() {
    console.log('this.functional', this.functional);
    if (this.savedConsent) {
      this.analyticsInput.checked = this.savedConsent.analytics_storage === 'granted' ? true : false;
      this.adTrackingInput.checked = this.savedConsent.ad_storage === 'granted' ? true : false;
      this.adPersonalizationInput.checked = this.savedConsent.ad_personalization === 'granted' ? true : false;
      this.functionalityInput.checked = this.savedConsent.functionality_storage === 'granted' ? true : false;
    } else {
      this.analyticsInput.checked = this.analytics ? true : false;
      this.adTrackingInput.checked = this.adTracking ? true : false;
      this.adPersonalizationInput.checked = this.adPersonalization ? true : false;
      this.functionalityInput.checked = (this.functional === true || this.functional === 'required') ? true : false;
    }

    if (this.functional === 'required') {
      this.functionalityInput.disabled = true;
    }
  }

  #localDataGet(name) {
    const value = localStorage.getItem(name);
    if (!value) return null;

    try {
      const obj = JSON.parse(value);
      const now = new Date();

      if (now.getTime() > obj.expiry) {
      // If the item is expired, delete it from storage and return null
      localStorage.removeItem(name);
      return null;
    }

    return obj;

    } catch (error) {
      console.error("Error parsing item from localStorage or checking expiry:", error);
      // If parsing fails or any other error occurs, treat it as invalid
      localStorage.removeItem(name);
      return null;
    }
  }

  #localDataRemove(name) {
    localStorage.removeItem(name);
  }

  #localDataSet(name, value, days) {
    // check if value contains one of the properties.
    if (!value.analytics_storage) {
      return console.error('Consent data not set. Data is most likely not an object');
    }

    const date = new Date();
    const expiry = date.getTime() + (days * 24 * 60 * 60 * 1000);
    value.expiry = value.expiry ? value.expiry : expiry;
    try {
      localStorage.setItem(name, JSON.stringify(value));
    } catch (error) {
      console.error("Consent data not set", error);
    }
  }

  /**
   * @description Process event when user checks or unchecks a checkbox.
   * @param {Event} event - The (click) event to process
   * @returns {object}    - The return value of this.choices
   */
  processInput(event) {
    if (event instanceof Event === false) throw new TypeError("0x00007FF723010001");
    if (!event.isTrusted) throw new DOMException("0x00007FF723010002", 'SecurityError');
    const elem = event.target;

    if (event.isTrusted && elem.type !== 'radio') {
      this.grantAllInput.checked = false;
      this.denyAllInput.checked = false;
    }

    switch (event.target.id) {
      case 'consent-all':
        if (elem.checked) {
          this.analytics = true;
          this.adTracking = true;
          this.userDataStorage = true;
          this.adPersonalization = true;
          if (this.functional !== 'required') this.functional = true;
        }
        break;
      case 'deny-all':
        if (elem.checked) {
          this.analytics = false;
          this.adTracking = false;
          this.userDataStorage = false;
          this.adPersonalization = false;
          if (this.functional !== 'required') this.functional = false;
        }
        break;
      case 'analytics-storage':
        this.analytics = elem.checked ? true : false;
        break;
      case 'ad-storage':
        if (elem.checked) {
          this.adTracking = true;
          this.userDataStorage = true;
        } else {
          this.adTracking = false;
          if (!this.adPersonalization) this.userDataStorage = false;
        }
        break;
      case 'ad-personalization':
        if (elem.checked) {
          this.adPersonalization = true;
          this.userDataStorage = true;
        } else {
          this.adPersonalization = false;
          if (!this.adTracking) this.userDataStorage = false;
        }
        break;
      case 'functionality-storage':
        if (this.functional !== 'required') {
          this.functional = elem.checked ? true : false;
        }
        break;
    }

    return this.choices();
  }

  resetConsent() {
    this.#localDataRemove(AConsent.storageKey);
  }

  async submitChoices(event) {
    event.preventDefault();
    if (event instanceof Event === false) throw new TypeError("0x00007FF723010003");
    if (!event.isTrusted) throw new DOMException("0x00007FF723010004", 'SecurityError');
    await this.#updateConsent(this.choices(), window.gtag);
    if (this.effect === 'fade') {
      this.fadeElement(this);
    } else {
      await this.explodeElement(this);
      this.remove();
    }
  }

  /**
   * @description Update Google gtag consent state
   * @param {object} consentState - The consent object (this.consent)
   * @param {function} gtag       - A reference to the gtag function;
   * @returns {boolean}           - True if gtag was successfully updated, false otherwise
   */
  async #updateConsent(consentState, gtag) {
    try {
      gtag('consent', 'update', consentState);
      this.#localDataSet(AConsent.storageKey, consentState, this.expire);

      // if this is inside a dialog element, the user probably clicked on an a-consent-edit link
      const dialog = this.closest('dialog');
      if (dialog) {
        const parentShadow = this.getRootNode();
        if (parentShadow.host.localName === 'a-consent-edit') parentShadow.host.hideForm();
      }
      // await this.explodeElement(this);
      // this.remove();

      return true;
    } catch (error) {
      console.error('Update failed', error);
      this.style.display = 'none';
      return false;
    }
  }

  /*************************
  * Attributes
  ***********************/

  get grantAll() { return this.#grantAll; }
  set grantAll(value) {
    if (typeof value === 'string') value = value.toLowerCase();
    switch (value) {
      case false:
      case 'false':
        this.#grantAll = false;
        break;
      default:
        this.grantAll = true;
        this.#denyAll = false;
        this.#adPersonalization = true;
        this.#adTracking = true;
        this.#analytics = true;
        this.#functional = true;
    }
  }

  get denyAll() { return this.#denyAll; }
  set denyAll(value) {
    if (typeof value === 'string') value = value.toLowerCase();
    switch (value) {
    case false:
    case 'false':
      this.#denyAll = false;
      break;
    default:
      this.#denyAll = true;
      this.#grantAll = false;
      this.#adPersonalization = false;
      this.#adTracking = false;
      this.#analytics = false;
      this.#functional = false;
    }
  }

  get adPersonalization() { return this.#adPersonalization; }
  set adPersonalization(value) {
    if (typeof value === 'string') value = value.toLowerCase();
    switch (value) {
      case 'false':
      case false:
        this.#adPersonalization = false;
        if (!this.adTracking) this.#userDataStorage = false;
        if (this.adPersonalizationInput) this.adPersonalizationInput.checked = false;
        break;
      default:
        this.#adPersonalization = true;
        this.#userDataStorage = true;
        if (this.adPersonalizationInput) this.adPersonalizationInput.checked = true;
    }
  }

  get adTracking() { return this.#adTracking; }
  set adTracking(value) {
    if (typeof value === 'string') value = value.toLowerCase();
    switch (value) {
      case 'false':
      case false:
        this.#adTracking = false;
        if (!this.adPersonalization) this.#userDataStorage = false;
        if (this.adTrackingInput) this.adTrackingInput.checked = false;
        break;
      default:
        this.#adTracking = true;
        this.#userDataStorage = true;
        if (this.adTrackingInput) this.adTrackingInput.checked = true;
        break;
    }
  }

  get analytics() { return this.#analytics; }
  set analytics(value) {
    if (typeof value === 'string') value = value.toLowerCase();
    switch (value) {
      case 'false':
      case false:
        this.#analytics = false;
        if (this.analyticsInput) this.analyticsInput.checked = false;
        break;
      default:
        this.#analytics = true;
        if (this.analyticsInput) this.analyticsInput.checked = true;
        break;
    }
  }

  get effect() { return this.#effect; }
  set effect(value) { this.#effect = value; }

  get expire() { return this.#expire; }
  set expire(value) {
    value = +value;
    if (isNaN(value)) {
      console.error(`Could not set expire on localStorage because the new value was: ${value}`);
    }

    const data = this.#localDataGet(AConsent.storageKey);
    const obj = JSON.parse(data);
    try {
      if (data) {
        delete obj.expiry;
        this.#localDataSet(AConsent.storageKey, obj, value);
      }

      this.#expire = value;
    } catch (error) {
      console.error('Could not set expire date', error);
    }
  }

  get functional() { return this.#functional; }
  set functional(value) {
    if (typeof value === 'string') value = value.toLowerCase();
    switch (value) {
      case 'false':
      case false:
        this.#functional = false;
        this.#securityStorage = false;
        if (this.functionalityInput) this.functionalityInput.checked = false;
        break;
      case 'required':
        this.#functional = 'required';
        this.#securityStorage = true;
        if (this.functionalityInput) this.functionalityInput.disabled = true;
        break;
      default:
        this.#functional = true;
        this.#securityStorage = true;
        if (this.functionalityInput) this.functionalityInput.checked = true;
        break;
    }
  }
}

document.addEventListener('DOMContentLoaded', customElements.define('a-consent', AConsent));

export class AConsentEdit extends AConsent {
  abortController = new AbortController();
  abortTransitionController;
  dialog;
  consentForm;

  static template = `
    <style>
      :host {
        --accent-color: dodgerblue;
        --accent-text: white;
        --min: 35px;
      }

      a { color: var(--accent-color); }

      button {
        border-radius: 10px;
        border: 1px solid var(--border-width);
        height: var(--min);
        width: var(--min);
        font-size: var(--min);
        line-height: 0;
        padding: 0;
      }

      button:hover {
        box-shadow: 1px 1px 2px black;
      }

      button:active {
        background: var(--accent-color);
        color: var(--accent-text);
        box-shadow: inset 2px 2px 5px black;
      }

      dialog {
        align-items: end;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        gap: .5rem;
        opacity: 1;
        padding: 0;
        transition: opacity .3s ease-out;
      }

      dialog.fade {
        opacity: 0;
      }

      dialog::backdrop {
        background: rgba(0, 0, 0, 0.7);
        opacity: 1;
        transition: all .3s ease-out;
      }

      dialog.fade::backdrop {
        opacity: 0;
      }
    </style>
    <a href="#" id="edit-link">
      <slot>Change your data-consent preferences.</slot>
    </a>
    <dialog class="fade" id="edit-dialog">
      <button id="close">✖</button>
    </dialog>
  `;

  constructor() {
    super();
  }

  connectedCallback() {
    customElements.whenDefined('a-consent')
    .then( () => {
      this.shadowRoot.innerHTML = AConsentEdit.template;
      this.dialog = this.shadowRoot.querySelector('dialog');
      const link = this.shadowRoot.querySelector('#edit-link');
      const closeBtn = this.shadowRoot.querySelector('#close');
      link.addEventListener('click', this.showForm.bind(this), {signal: this.abortController.signal});
      closeBtn.addEventListener('click', this.hideForm.bind(this), {signal: this.abortController.signal});
    });
  }

  disconnectedCallback() {
    this.abortController.abort();
  }

  hideForm() {
    this.dialog.classList.add('fade');
    this.dialog.addEventListener('transitionend', event => {
      this.dialog.close();
      this.consentForm.remove();
      this.abortTransitionController.abort();
      this.abortTransitionController = null;
    }, {signal: this.abortTransitionController.signal});
  }

  showForm() {
    this.consentForm = document.querySelector('a-consent');
    this.abortTransitionController = new AbortController();
    if (!this.consentForm) this.consentForm = document.createElement('a-consent');
    this.consentForm.force = true;
    this.dialog.append(this.consentForm);
    this.dialog.showModal();
    this.dialog.classList.remove('fade');
  }
}

document.addEventListener('DOMContentLoaded', customElements.define('a-consent-edit', AConsentEdit));
