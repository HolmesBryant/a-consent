/**
 * @class ATestRunner
 * @description A test runner for ECMAScript modules
 * @author Holmes Bryant <https://github.com/HolmesBryant>
 * @license GPL-3.0
 */

export default class ATestRunner {
  filePath;

  initialized = false;

  lineNumbers = true;

  modules = {};

  onlyFailed = false;

  /**
   * @private
   * @description What order to print test results, "asc" or "desc". Has public getter/setter. Only matters if #output is not "console".
   * @type {string}
   */
  #order;

  /**
   * @private
   * @description Where to print the test results. Either "console" or a css id selector such as "#test-output". Has public getter/setter.
   * @type {string}
   */
  #output = "console";

  pauseOnFail = false;

  /**
   * @type {string}
   * @description Where to insert each test result, "afterbegin" or "beforeend". Used with insertAdjacentHTML(). "afterbegin" orders the list "desc" and "beforeend" orders it "asc".
   */
  position = "beforeend"

  /**
   * @description Timestamp of when the test run started.
   * @type {number}
   */
  startTime = Date.now();

  /**
   * @description Optional html template with which to print the results. Only applies if this.output is not "console". This is an object containing two properties: "template" and "slot". "template" is the html and css. "slot" is a css selector pointing to the element in which to inject the results.
   * @type {object {template, slot}}
   */
  template;

  /**
   * The sequential test number (starting from 1) for the current test run.
   *
   * @type {number}
   */
  testNum = 0;

  tests = new Set();

  totalTests = 0;

  constructor(filePath = null, output) {
    this.filePath = filePath;
    if (output) this.output = output;
    this.A = new A();
    if (filePath === null) return this.A._init(this);
  }

  /**
   * Converts milliseconds into hours, minutes, seconds and milliseconds
   * @param  {number} milliseconds  - The number of milliseconds
   * @returns {object}               - An object with the properties {hours, minutes, seconds, milliseconds}
   */
  convertTime( milliseconds ) {
    return {
      hours: Math.floor(milliseconds / 3600000),
      minutes: Math.floor((milliseconds % 3600000) / 60000),
      seconds: Math.floor(((milliseconds % 3600000) % 60000) / 1000),
      milliseconds: milliseconds % 1000
    }
  }

  async fetchCode(url = null) {
    url = url || this.filePath;
    if (this.#isNodeEnv()) return this.#NodeReadfile(url);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      throw new Error(`Failed to fetch ${url}`, { cause: error });
    }
  }

  #getLineNumber(matchIndex, strCode) {
    let lineNumber = 1;
    const lineBreaks = [...strCode.matchAll(/\n/g)].map(match => match.index);

    for (const lineBreakIndex of lineBreaks){
      if (matchIndex > lineBreakIndex) {
        lineNumber++;
      } else {
        break;
      }
    }

    return lineNumber;
  }

  async getModules(filePath = null) {
    filePath = filePath ?? this.filePath;
    let mods;
    if (this.#isNodeEnv()) {
      mods = await this.#NodeGetModules(filePath);
    } else {
      try {
        mods = await import(filePath);
      } catch (error) {
        throw new Error(`getModules failed to import modules from: ${filePath}`, { cause: error });
      }
    }

    for (const key in mods) {
      this.modules[key] = mods[key];
    }

    return this.modules;
  }

  /**
   * Extracts test definitions from a string.
   * @param {string} strCode - The code (string) to extract tests from.
   * @returns {Set}  - A Set of tests
   */
  getTests(strCode = null) {
    strCode = strCode ?? this.fetchCode();
    // const testRegex = (this.isScript) ? /test\s*\(([^,]+),([^)]+)\)/g : /@test([\s\S]*?)\\{2}([^\n]*)\n/g;
    const testRegex = /@test([\s\S]*?)\\{2}([^\n]*)\n/g;
    const matches = strCode.matchAll(testRegex);
    for (const match of matches) {
      const func = match[1].trim();
      let expected = match[2].replace('\\', '').trim();
      const line = (this.lineNumbers) ? this.#getLineNumber(match.index, strCode) : null;
      this.tests.add([func, expected, line]);
      if (!func.startsWith('mock')) this.totalTests++;
    }

    return this.tests;
  }

  #getVerdict(result, expected, line) {
    let errMsg;
    try {
      if ((typeof result === 'object') && (result instanceof HTMLElement === false)) {
        result = JSON.stringify(result);
      } else if (typeof result === 'string') {
        result = result.replace(/'/g, "");
      }
    } catch (error) {
      //test, verdict, result, expected, line
      errMsg = 'getVerdict error with result value';
      this.printResult(errMsg, 'error', result, null, line);
      throw new Error(`${errMsg} on line ${line}`, {cause: error});
    }

    try {
      if ((typeof expected === 'object') && (result instanceof HTMLElement === false)) {
        expected = JSON.stringify(expected)
      }
    } catch (error) {
      errMsg = 'getVerdict error with expected value';
      this.printResult(errMsg, 'error', null, expected, line);
      console.error(`${errMsg} on line ${line}`, error);
    }

    return (result === expected) ? 'pass' : 'fail';
  }

  async init(filePath) {
    if (this.initialized) return;
    let code;
    filePath = filePath || this.filePath;

    try {
      if (filePath) {
        code = await this.fetchCode(filePath);
      } else {
        throw new Error('No file path provided');
      }

      this.getTests(code);
      const modules = await this.getModules();
      for (const mod in modules) {
        this.A[mod] = modules[mod];
      }

    } catch (error) {
      this.printResult(`ATestRunner: ${error.message} | ${error.cause}`, 'error', null, null, null);
      throw new Error("Could not initialize:", { cause: error });
    }

    this.initialized = true;
    return this;
  }

  #isNodeEnv() {
    return typeof process !== 'undefined' && process.versions && process.versions.node
  }

  async #NodeGetModules(strPath) {
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const absoluteFilePath = path.resolve(strPath);
    const fileURL = new URL(`file:///${absoluteFilePath}`);
    try {
      const modules = await import(fileURL);
      return modules;
    } catch (error) {
       throw new Error (`NodeGetModules failed to import the module at ${fileURL}`, { cause:error });
    }
  }

  async #NodeReadfile(path) {
    path = path || this.filePath;

    try {
      if (this.#isNodeEnv()) {
        const fs = await import('node:fs/promises')
        return await fs.readFile(path, 'utf-8');
      } else {
          throw new Error('Node.js file reading is not supported in this environment');
      }
    } catch (error) {
      throw new Error(`NodeReadfile to read ${path}: ${error.message}`);
    }
  }

  #printDOM(test, verdict, result, expected, line, testNum) {
    testNum = testNum ?? '';

    if (!this.output) throw new Error(`No DOM container was found.`);

    // if (typeof expected === "string") expected = `"${expected}"`;
    // if (typeof result === "string") result = `"${result}"`;

    if (typeof expected === 'object' && expected !== null && expected !== undefined) {
      expected = JSON.stringify(expected);
    }

    if (typeof result === 'object' && expected !== null && expected !== undefined) {
      result = JSON.stringify(result);
    }

    let html = `
      <div class="${verdict}">
      <span class="test-num">${testNum}</span>
      <span class="verdict"><b>${verdict}</b></span>
    `;

    if (expected !== null) {
      html += `<span class="expected"><b>Expected: </b>${expected}</span>`;
    }

    if (result !== null) {
      if (verdict === 'info') {
        html += `<span class="result">${result}</span>`;
      } else {
        html += `<span class="result"><b>Result: </b>${result}</span>`;
      }
    }

    if (line !== null) {
      html += `<span class="line"><b>Line: </b>${line}</span>`
    }

    html += `
      <pre class="test">${test}</pre>
      </div>
    `;

    if (this.template) {
      let frag;
      let tmpl = this.template.template;
      let slot = this.template.slot;
      if (tmpl instanceof HTMLTemplateElement) {
        frag = tmpl.content;
      } else if (tmpl instanceof HTMLElement) {
        frag = document.createRange().createContextualFragment(tmpl.innerHTML);
      } else if (typeof tmpl === "string") {
        frag = document.createRange().createContextualFragment(tmpl);
      }

      if (slot = frag.querySelector(slot)) {
        slot.insertAdjacentHTML(this.position, html);
        if (!this.output.shadowRoot) this.output.attachShadow( {mode:"open"} );
      } else {
        console.warn(`Could not find ${slot} in template`);
        this.output.insertAdjacentHTML(this.position, html);
      }

      if (this.position === "afterbegin") {
        this.output.shadowRoot.prepend(frag);
      } else {
        this.output.shadowRoot.append(frag);
      }

    } else {
      this.output.insertAdjacentHTML(this.position, html);
    }
  }

  getStyle(verdict) {
    let style;
    switch (verdict) {
    case 'pass':
      style = 'color:limegreen; font-weight:bold';
      break;
    case 'fail':
      style = 'color:red; font-weight:bold';
      break;
    case 'info':
      style = 'color:darkorange; font-weight:bold';
      break;
    default:
      style = 'color:dodgerblue; font-weight:bold';
    }

    return style;
  }

  printResult(test, verdict, result, expected, line) {
    // more efficient than padStart()
    const testNum = (this.testNum) ? String(100 + this.testNum).slice(-2) : '';

    if (this.onlyFailed && (verdict === 'pass' || verdict === 'mock' || verdict ==='info')) return;
    const style = this.getStyle(verdict);
    test = (typeof test === 'string') ? test.replace(/[\t\n]+|\s{2,}/g, '') : JSON.stringify(test);

    switch (verdict) {
    case 'fail':
      if (this.output === "console") {
        if (line === null) {
          console.debug(`${this.testNum}: %c${verdict}`, style, test, {expected:expected, result:result});
        } else {
          console.debug(`${this.testNum}: %c${verdict}`, style, test, {expected:expected, result:result, line:line});
        }
      } else {
        this.#printDOM(test, verdict, result, expected, line, testNum);
      }
      break;
    case 'pass':
      if (!this.onlyFailed && this.output === "console") {
        if (line === null) {
          console.debug(`${this.testNum}: %c${verdict}`, style, test, {expected:expected, result:result});
        } else {
          console.debug(`${this.testNum}: %c${verdict}`, style, test, {expected:expected, result:result, line:line});
        }
      } else if (!this.onlyFailed) {
        this.#printDOM(test, verdict, result, expected, line, testNum);
      }
      break;
    case 'mock':
    case 'info':
    case 'elapsed':
      if (this.output === "console") {
        if (line === null) {
          console.debug(`%c${verdict} | ${test}`, style);
        } else {
          console.debug(`%c${verdict} | ${line} | ${test}`, style);
        }
      } else {
        this.#printDOM(test, verdict, null, null, line, null);
      }
      break;
    default:
      if (this.output === "console") {
        line = (line === null) ? '' : `on line ${line}`;
        console.debug(`%c${verdict} ${result} ${line} | ${test}`, style);
      } else {
        this.#printDOM(test, verdict, result, null, line, null);
      }
    }
  }

  async run() {
    if (!this.initialized) await this.init();
    if (this.output === "console") {
      console.debug(`ATestRunner starting: ${this.filePath}`);
      console.debug(`Total tests found: ${this.totalTests}`);
    } else {
      this.printResult(`Total tests: ${this.totalTests}`, 'info', null, null, null);
    }
    let msg, result, expected, mod, passing = true;
    let a = this.A;

    // a.mod is for convenience, so you can write `a.mod = new MyClass()` then later `mod.someMethod()` instead of `a.classInstance.someMethod()`
    // However `a.classInstance = new MyClass()` and `a.classInstance.someMethod()` also works.
    a.mod = null;

    for (const test of this.tests) {
      mod = a.mod;
      let strFunc = test[0].split("\n").map(x => x.trim()).join('');
      const line = test[2];
      // mock
      if (strFunc.startsWith('mock')) {
        strFunc = strFunc.replace("mock", "").trim();
        try {
          const mockFunc = new Function('a, mod', `${strFunc}`);
          result = await mockFunc(a, mod);
        } catch (error) {
          passing = false;
          msg = `Error parsing mock expression.`;
          this.printResult(strFunc, 'error', `${msg} ${error.message}`, '', line)
          console.error(`${msg} on line: ${line}`, error);
        }

        this.printResult(strFunc, 'mock', null, null, line);
        continue;
      }

      this.testNum++;
      mod = a.mod;

      // result
      try {
        const funcStr = (/\breturn\b/.test(strFunc)) ? strFunc : `return ${strFunc}`;
        const func = new Function('a, mod', funcStr);
        result = await func(a, mod);
      } catch (error) {
        passing = false;
        msg = `Error parsing test.`;
        this.printResult(strFunc, 'error', `${msg} ${error.message}`, null, line)
        console.error(`${msg} on line: ${line}`, error);
        continue;
      }

      // expected
      try {
        const expectFunc = new Function('a', `return ${test[1]}`);
        expected = await expectFunc(a);
      } catch (error) {
        passing = false;
        msg = `Error parsing expected value.`;
        this.printResult(strFunc, 'error', `${msg} ${error.message}`, null, line)
        console.error(`${msg} on line: ${line}`, error);
        continue;
      }

      // verdict
      const verdict = this.#getVerdict(result, expected, line);
      if (verdict === "fail") passing = false;

      // print result
      this.printResult(strFunc, verdict, result, expected, line);

      // pause on failed test
      if (verdict === 'fail' && this.pauseOnFail) {
        this.printResult('', 'paused', 'Test runner has paused...', '', '');
      }
    }

    const time = this.convertTime(Date.now() - this.startTime);
    this.printResult(`${time.hours}:${time.minutes}:${time.seconds}:${time.milliseconds}`, 'elapsed', null, null, null);

    return passing;
  }

  get order() {
    return (this.position === "afterbegin") ? "desc" : "asc";
  }

  set order(value) {
    if (value.toLowerCase() === "desc") {
      this.position = "afterbegin";
      this.#order = "desc";
    } else {
      this.position = "beforeend";
      this.#order = "asc";
    }
  }

  get output() { return this.#output; }
  set output(value) {
    if (value instanceof HTMLElement) {
      this.#output = value;
    } else if (value.toLowerCase() === "console") {
      this.#output = "console";
    } else {
      this.#output = document.body.querySelector(value);
      if (!this.#output) {
        console.warn(`ATestRunner cannot find ${value} in the DOM. Defaulting to "console".`);
        this.#output = "console";
      }
    }
  }
}

class A {
  lineNumbers = null;
  onlyFailed = null;
  output = null;
  pauseOnFail = null;
  startTime = Date.now();
  template = null;
  passing = true;

  /**
   * @description Delays execution of scripts, most useful inside a loop
   * @param {integer} ms - The number of milliseconds to delay
   * @returns {Promise} - A Promise which resolves after ms milliseconds.
   * @example for (const a of b) { console.log(a); a.delay(1000); }
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * @description Print the time elapsed
   */
  elapsed() {
    const time = this.testRunner.convertTime(Date.now() - this.startTime);
    const style = "font-weight:bold; color:lime";
    if (this.passing) console.debug("%cPassed", style);
    this.testRunner.printResult(`${time.hours}:${time.minutes}:${time.seconds}:${time.milliseconds}`, 'elapsed', null, null, null);
  }

  /**
   * @description Determines if two values are equal or two objects have the same properties/values. Helper function for tests. Invoke it in your tests.js file.
   * @param {object} a   - The first object to compare
   * @param {object} b   - The second object to compare
   * @returns {boolean}  - true if the objects are equal, false otherwise.
   */
  equal(a, b) {
    return a === b || (a != null && b != null && typeof a === 'object' && typeof b === 'object' && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => a[k] === b[k]) );
  }

  /**
   * @description A generator method that yields all possible combinations
   * @param {object} options - An object where the value of each property is an array of possible values
   * @yields {object} an object where the value of each property is one of the possible values in the original propertys array.
   * @example genCombos({ foo: ['a', 'b', 'c'], bar: [1, 2, 3] })
   */
  *genCombos(options) {
    const keys = Object.keys(options);
    const values = Object.values(options);

    function* generate(index, currentCombination) {
      if (index === keys.length) {
        yield { ...currentCombination }; // Create a new object to avoid mutation issues
        return;
      }

      const key = keys[index];
      const value = values[index];

      if (Array.isArray(value)) {
        for (const element of value) {
          currentCombination[key] = element;
          yield* generate(index + 1, currentCombination);
        }
      } else {
        currentCombination[key] = value;
        yield* generate(index + 1, currentCombination);
      }
    }

    yield* generate(0, {});
  }

  /**
   * @description Prints an informational message either to the console or to the element defined by this.output
   * @param {string} message - The message
   * @example info('this is a message')
   */
  info(message) {
    if (this.onlyFailed) return;
    let line = null;
    if (this.lineNumbers) {
      try {
        throw new Error("");
      } catch (error) {
        const parts = error.stack.split("\n");
        line = parts[2].substring(parts[2].lastIndexOf("/") + 1, parts[2].lastIndexOf(":"));
      }
    }
    this.testRunner.printResult(message, "info", null, null, line);
  }

  /**
   * @description Initialize class, providing a reference to the ATestRunner class.
   * @param testRunner {ATestRunner} - An instance of ATestRunner class
   */
  _init(testRunner) {
    this.testRunner = testRunner;
    return this;
  }

  /**
   * @description Tests an expression and prints the result either to the console or to the html element defined by this.output
   * @param {string} message - A string describing the purpose of the test
   * @param {any} expression - the expression being tested.
   * @param {any} expected - The expected value. The pass/fail verdict is determined by expression === expected.
   * @example test("foo is Bar", foo === 'Bar', true)
   */
  async test(message, expression, expected) {
    this.testNum++;
    let line = null;
    const verdict = (expression === expected)? "pass" : "fail";
    if (this.testRunner.lineNumbers) {
      try {
        throw new Error("");
      } catch (error) {
        const parts = error.stack.split("\n");
        line = parts[2].substring(parts[2].lastIndexOf("/") + 1, parts[2].lastIndexOf(":"));
      }
    }

    if (verdict === 'fail') this.passing = false;
    if (verdict === 'pass' && this.onlyFailed) return;
    this.testRunner.printResult(message, verdict, expression, expected, line);
    /*if (verdict === 'fail' && this.pauseOnFail) {
      this.testRunner.printResult('', 'paused', 'Test runner has paused...', '', line);
    }*/
  }

  /**
   * @description Waits until the whenExpression evaluates strictly to `true`.
   *
   * @param {() => (Promise<any> | any)} whenExpression - A function that returns a value or a Promise.
   * @param {object} [options]                          - Optional configuration.
   * @param {number} [options.checkIntervalMs=500]      - How often (in milliseconds) to re-evaluate whenExpression.
   * @param {number|null} [options.timeoutMs=2000]      - Maximum time (in milliseconds) to wait for whenExpression to become true. If null, waits indefinitely.
   * @throws {Error}                                    - Throws an error on timeout.
   * @returns {Promise<true>}                           - A Promise that resolves with `true` when the condition is met. Rejects if whenExpression throws/rejects, or if the timeout is reached.
   */
  async when(whenExpression, { checkIntervalMs = 500, timeoutMs = 2000 } = {}) {
    const startTime = Date.now();
    while (true) {
      if (timeoutMs !== null && (Date.now() - startTime) >= timeoutMs) {
        throw new Error(`when() timed out after ${timeoutMs}ms waiting for condition to be true`);
      }

      const conditionResult = await whenExpression();
      if (conditionResult === true) return true;

      // Condition not met, wait
      await this.delay(checkIntervalMs);
      // Loop continues...
    }
  }

  /**
   * @description Checks if multiple custom elements are defined.
   * @param {string[]} elementNames - An array of custom element tag names (e.g., ['my-element', 'another-element']).
   * @param {number} [timeout=0] - The maximum time (in milliseconds) to wait for all elements to be defined.  Defaults to 0.
   * @returns {Promise<void>} - A promise that resolves when all custom elements are defined or rejects if the timeout is reached.
   * @throws {Error} - Rejects and throws an error if timeout is reached and all tagNames have not been defined.
   */
  async whenAllDefined(tagNames = [], timeout = 0) {
  return new Promise((resolve, reject) => {
    let timeoutId;
    Promise.all(tagNames.map(tag => customElements.whenDefined(tag)))
    .then(results => {
      clearTimeout(timeoutId);
      resolve(results);
    })
    .catch(error => {
      clearTimeout(timeoutId); // Clear the timeout even if there's an error
      reject(error);
    });

    timeoutId = setTimeout(() => {
      reject(new Error("Timed out waiting for custom elements"));
    }, timeout);
  });
  }
}

/**
 * @class TestRunnerComponent
 * @description A web component to be used with ATestRunner
 * @author Holmes Bryant <https://github.com/HolmesBryant>
 * @license GPL-3.0
 */
export class TestRunnerComponent extends HTMLElement {
  /**
   * @description Whether to show all tests instead of just failed tests
   * @type {boolean}
   */
  #all = false;

  /**
   * @description Whether to display test results in the console instead of an html page.
   * @type {boolean}
   */
  #console = false;

  /**
   * @description Whether to show the time it took to run all the tests
   * @type {boolean}
   */
  #elapsed = true;

  /**
   * @description The path to the javascript module that contains the tests
   * @type {string}
   */
  #file = "";

  /**
   * @description Whether the html dialog containing the tests is open by default
   * @type {boolean}
   */
  #open = false;

  /**
   * @description What order to print the tests, "asc" or "desc"
   * @type {string}
   */
  #order = "asc";

  /**
   * @description Whether to pause on a failed test
   * @type {boolean}
   */
  #pause = false;

  summary = HTMLElement;
  timeStart = Date.now();


  static observedAttributes = ['all', 'console', 'elapsed', 'file', 'open', 'order', 'pause'];
  static template = `
    <style>
      :host {
        display: block;
        --pass: lightgreen;
        --fail: salmon;
      }

      div {
        border-top: 1px solid gray;
        display: grid;
        column-gap: 1rem;
        grid-template-columns: clamp(2ch, 3ch, 6ch) 4ch 2fr 2fr 1fr;
        overflow-y: clip;
        overflow-x: auto;
        padding: 0 .25rem;
      }

      div.pass {
        background-color: var(--pass);
        color: black;
      }

      div.fail {
        background-color: var(--fail);
        color: black;
      }

      div.mock,
      div.error) {
        display: flex;
        gap: 2rem;
      }

      div.error {
        background: darkred;
        color: white;
      }

      .test {
        grid-column: auto / span 5;
      }

      summary { padding: .25rem; cursor:pointer }
      summary.pass { background: limegreen; }
      summary.pass::after { content: " Passing"; }
      summary.fail { background: indianred; }
      summary.fail::after { content: " Failing"; }
    </style>
    <details>
      <summary> <slot name="title">Tests:</slot> </summary>
      <section id="tests"></section>
    </details>`;

  constructor() {
    super();
    this.attachShadow( {mode: 'open'} );
    this.shadowRoot.innerHTML = TestRunnerComponent.template;
  }

  async connectedCallback() {
    this.summary = this.shadowRoot.querySelector('summary');
    this.tester = new ATestRunner(this.file);
    this.tester.output = this.shadowRoot.querySelector('#tests');
    this.tester.onlyFailed = !this.all;
    this.tester.pauseOnFail = this.pause;
    this.tester.order = this.order;
    this.summary.textContent += ` ${this.file} | `;
    this.testFile(this.file);
  }

  attributeChangedCallback(attr, oldval, newval) {
    this[attr] = newval;
  }

  async testFile(filePath) {
    const passing = await this.tester.run();
    this.summary.className = (passing) ? 'pass' : 'fail';
    if (this.elapsed) {
      const time = this.tester.convertTime(Date.now() - this.timeStart);
      this.summary.textContent += `${time.hours}:${time.minutes}:${time.seconds}:${time.milliseconds} |`;
    }
  }

  get console() { return this.#console }
  set console(value) {
    switch (value) {
    case false:
    case 'false':
      this.#console = false;
      break;
    default:
      this.#console = true;
    }
  }

  get elapsed() { return this.#elapsed; }
  set elapsed(value) {
    switch(value) {
    case 'false':
    case false:
      this.#elapsed = false;
      break;
    default:
      this.#elapsed = true;
    }
  }

  get all() { return this.#all; }
  set all(value) {
    switch (value) {
    case false:
    case 'false':
      this.#all = false;
      break;
    default:
      this.#all = true;
    }
  }

  get file() { return this.#file }
  set file(value) {
    if (!value.startsWith('.') || !value.startsWith('/')) {
      value = '/' + value;
    }
    this.#file = value;
  }

  get open() { return this.#open; }
  set open(value) {
    const details = this.shadowRoot.querySelector('details');
    switch (value) {
    case 'false':
    case false:
      this.#open = false;
      details.toggleAttribute('open', false);
      break;
    default:
      this.#open = true;
      details.toggleAttribute('open', true);
    }
  }

  get order() { return this.#order; }
  set order(value) {
    if (value === "asc" || value === "desc") this.#order = value;
  }

  get pause() { return this.#pause; }
  set pause(value) {
    switch (value) {
      case 'false':
      case false:
        this.#pause = false;
        break;
      default:
        this.#pause = true;
    }
  }
}

customElements.define('test-runner', TestRunnerComponent);
