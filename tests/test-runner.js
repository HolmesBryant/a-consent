const TestRunner = (() => {
  let tests = [];
  let currentSuite = '';
  let passed = 0;
  let failed = 0;
  let beforeEachCallback = null;
  let afterEachCallback = null;
  const mockLocalStorage = {};
  let originalLocalStorage = null;
  const spies = [];

  function describe(description, callback) {
      console.log(`%cSuite: ${description}`, 'font-weight: bold; color: blue;');
      currentSuite = description;
      // Reset hooks for the new suite
      beforeEachCallback = null;
      afterEachCallback = null;
      callback();
      currentSuite = ''; // Reset after suite finishes
  }

  function it(description, testFn) {
  	tests.push({ description, testFn, suite: currentSuite, beforeEach: beforeEachCallback, afterEach: afterEachCallback });
  }

  function beforeEach(callback) {
	  beforeEachCallback = callback;
  }

  function afterEach(callback) {
	  afterEachCallback = callback;
  }

  // --- Mocking & Spying ---

  function mockWindowProperty(prop, value) {
    const original = window[prop];
    window[prop] = value;
    return {
      restore: () => { window[prop] = original; }
    };
  }

	function mockDocumentMethod(methodName, mockFn) {
		const original = document[methodName];
    document[methodName] = mockFn;
    return {
      restore: () => { document[methodName] = original; }
    };
  }

  function mockElementMethod(element, methodName, mockFn) {
    const original = element[methodName];
    if (typeof original !== 'function') {
      console.warn(`Cannot mock non-function property: ${methodName}`);
      return { restore: () => {} };
    }
    element[methodName] = mockFn;
    return {
      restore: () => { element[methodName] = original; }
    };
  }

  function mockPrototypeMethod(classProto, methodName, mockFn) {
    const original = classProto[methodName];
    if (typeof original !== 'function') {
      console.warn(`Cannot mock non-function prototype property: ${methodName}`);
      return { restore: () => {} };
	  }
  	classProto[methodName] = mockFn;
  	return {
    	restore: () => { classProto[methodName] = original; }
  	};
  }


  function useMockLocalStorage() {
    originalLocalStorage = window.localStorage;
    Object.defineProperty(
    	window,
    	'localStorage',
    	{
	    	value: {
	      	getItem: (key) => mockLocalStorage[key] || null,
	      	setItem: (key, value) => { mockLocalStorage[key] = String(value); },
	      	removeItem: (key) => { delete mockLocalStorage[key]; },
	      	clear: () => {
	        	for (const key in mockLocalStorage) {
	          	delete mockLocalStorage[key];
	        	}
	      	},
	      	key: (index) => Object.keys(mockLocalStorage)[index] || null,
	      	get length() { return Object.keys(mockLocalStorage).length; }
	    	},
    		writable: true, // Allows us to restore it later
    		configurable: true
	  	}
		);

    mockLocalStorage.clear(); // Start clean
  }

  function restoreLocalStorage() {
    if (originalLocalStorage) {
	    Object.defineProperty(
	    	window,
	    	'localStorage',
	    	{
		    	value: originalLocalStorage,
	      	writable: true,
	      	configurable: true
	    	}
	    );

    	originalLocalStorage = null;
    }

    mockLocalStorage.clear();
  }

	function createSpy(obj, methodName, callThrough = false) {
		const originalMethod = obj[methodName];
    if (typeof originalMethod !== 'function') {
      console.error(`Cannot spy on non-function property: ${methodName}`);
      return null;
    }

    const spyData = {
      calls: [],
      original: originalMethod,
      restore: () => { obj[methodName] = originalMethod; removeSpy(spyData); },
      mostRecentCallArgs: () => spyData.calls.length > 0 ? spyData.calls[spyData.calls.length - 1] : undefined,
      callCount: () => spyData.calls.length
    };

    spies.push(spyData);

    obj[methodName] = (...args) => {
      spyData.calls.push(args);
      if (callThrough) {
        return originalMethod.apply(obj, args);
      }

      return undefined; // Default spy behavior
    };

	  return spyData;
  }

  function removeSpy(spyData) {
	  const index = spies.indexOf(spyData);
    if (index > -1) {
      spies.splice(index, 1);
    }
  }

  function restoreAllSpies() {
    // Restore in reverse order to handle nested spies if necessary
    while (spies.length > 0) {
      spies.pop().restore();
    }
  }

  // --- Assertions ---

  function expect(actual) {
    return {
      toBe: (expected) => {
        if (actual !== expected) {
          throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
        }
      },
      toEqual: (expected) => {
				// Simple deep comparison for objects/arrays
      	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      		// More informative error for objects
      		if (typeof actual === 'object' && typeof expected === 'object') {
						throw new Error(`Expected object ${JSON.stringify(actual, null, 2)} to equal ${JSON.stringify(expected, null, 2)}`);
      		}

      		throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
        }
      },
      toBeTruthy: () => {
        if (!actual) {
          throw new Error(`Expected ${JSON.stringify(actual)} to be truthy`);
        }
      },
      toBeFalsy: () => {
        if (actual) {
          throw new Error(`Expected ${JSON.stringify(actual)} to be falsy`);
        }
      },
			toBeNull: () => {
        if (actual !== null) {
          throw new Error(`Expected ${JSON.stringify(actual)} to be null`);
        }
      },
      toBeDefined: () => {
        if (actual === undefined) {
          throw new Error(`Expected value to be defined, but received undefined`);
        }
      },
      toBeInstanceOf: (expectedClass) => {
        if (!(actual instanceof expectedClass)) {
          const actualType = actual ? actual.constructor.name : typeof actual;
          throw new Error(`Expected instance of ${expectedClass.name}, but received ${actualType}`);
        }
      },
      toContain: (expectedSubstring) => {
        if (typeof actual !== 'string' || !actual.includes(expectedSubstring)) {
					throw new Error(`Expected "${actual}" to contain "${expectedSubstring}"`);
        }
      },
			toHaveProperty: (propName) => {
				if (actual === null || typeof actual !== 'object' || !(propName in actual)) {
					throw new Error(`Expected object ${JSON.stringify(actual)} to have property "${propName}"`);
        }
      },
      toHaveBeenCalled: (spy) => {
        if (!spy || typeof spy.callCount !== 'function') throw new Error('Argument must be a spy created with createSpy()');
        if (spy.callCount() === 0) {
          throw new Error(`Expected spy to have been called.`);
        }
      },
      toHaveBeenCalledTimes: (spy, times) => {
				if (!spy || typeof spy.callCount !== 'function') throw new Error('Argument must be a spy created with createSpy()');
				if (spy.callCount() !== times) {
          throw new Error(`Expected spy to have been called ${times} times, but was called ${spy.callCount()} times.`);
        }
      },
      toHaveBeenCalledWith: (spy, ...expectedArgs) => {
				if (!spy || typeof spy.mostRecentCallArgs !== 'function') throw new Error('Argument must be a spy created with createSpy()');
				const lastArgs = spy.mostRecentCallArgs();
				if (!lastArgs) {
          throw new Error(`Expected spy to have been called with ${JSON.stringify(expectedArgs)}, but it was not called.`);
				}
				if (JSON.stringify(lastArgs) !== JSON.stringify(expectedArgs)) {
          throw new Error(`Expected spy to have been called with ${JSON.stringify(expectedArgs)}, but was called with ${JSON.stringify(lastArgs)}.`);
				}
      },
			toThrow: (expectedError) => {
	        if (typeof actual !== 'function') {
	          throw new Error('Expected value must be a function to test for throwing.');
	        }
          let thrownError = null;
          try {
            actual();
          } catch (e) {
            thrownError = e;
          }

          if (!thrownError) {
            throw new Error('Expected function to throw, but it did not.');
          }

          if (expectedError) {
            if (typeof expectedError === 'string' && thrownError.message !== expectedError) {
              throw new Error(`Expected function to throw error with message "${expectedError}", but got "${thrownError.message}".`);
            } else if (expectedError instanceof Error && thrownError.message !== expectedError.message) {

						throw new Error(`Expected function to throw error with message "${expectedError.message}", but got "${thrownError.message}".`);
          } else if (expectedError instanceof Function && !(thrownError instanceof expectedError)) {
            throw new Error(`Expected function to throw instance of ${expectedError.name}, but got ${thrownError.constructor.name}.`);
          }
        }
      }
    };
  }

  // --- Test Execution ---

  async function runTests() {
	  console.log('%cStarting tests...', 'font-weight: bold;');
    passed = 0;
    failed = 0;
    const testPromises = [];

    for (const test of tests) {
	    // Wrap test execution in a promise to run sequentially
			testPromises.push(async () => {
				let testError = null;
        try {
          // --- Setup ---
          restoreAllSpies(); // Clean spies from previous test
          restoreLocalStorage(); // Clean localStorage from previous test
          if (test.beforeEach) {
            useMockLocalStorage(); // Enable mock localStorage for tests that need it
              await test.beforeEach();
            }

          // --- Execute ---
          await test.testFn(); // Run the actual test function

          // --- Report Success ---
          passed++;
          console.log(`  %c✓ ${test.description}`, 'color: green;');
        } catch (error) {
          // --- Report Failure ---
          failed++;
          testError = error; // Store error to report after cleanup
          console.error(`  %c✗ ${test.description}`, 'color: red;');
          console.error(`    Error in suite "${test.suite}":`, error.message);
          // log stack trace for easier debugging:
          console.error(error.stack);
        } finally {
          // --- Teardown ---
          if (test.afterEach) {
						try {
							await test.afterEach();
						} catch (teardownError) {
							console.error(`  %c! Error during afterEach for "${test.description}":`, 'color: orange;', teardownError.message);
							// Ensure original test error isn't lost if afterEach also throws
							if (!testError) {
                failed++; // Count teardown error as a failure if the test itself passed
                passed--;
							}
            }
          }

					restoreAllSpies(); // Ensure spies are restored even if errors occur
					restoreLocalStorage(); // Ensure local storage is restored
        }
      });
    }

		// Run tests one by one
    for (const run of testPromises) {
      await run();
    }

		// --- Summary ---
    console.log('\n%c--- Test Summary ---', 'font-weight: bold;');
    console.log(`%cTotal Tests: ${tests.length}`, 'font-weight: bold;');
    console.log(`%cPassed: ${passed}`, 'color: green; font-weight: bold;');
    console.log(`%cFailed: ${failed}`, 'color: red; font-weight: bold;');
    console.log('%c--------------------', 'font-weight: bold;');

    tests = []; // Clear tests for potential re-runs
  }

  // --- Public API ---
  return {
    describe,
    it,
    beforeEach,
    afterEach,
    expect,
    runTests,
    createSpy,
    restoreAllSpies,
    mockWindowProperty,
    mockDocumentMethod,
    mockElementMethod,
    mockPrototypeMethod,
    // Expose mock localStorage control if needed outside beforeEach/afterEach
    useMockLocalStorage,
    restoreLocalStorage
  };

})();

// Make functions globally available for test files
const describe = TestRunner.describe;
const it = TestRunner.it;
const expect = TestRunner.expect;
const beforeEach = TestRunner.beforeEach;
const afterEach = TestRunner.afterEach;
const createSpy = TestRunner.createSpy;
const mockWindowProperty = TestRunner.mockWindowProperty;
const mockDocumentMethod = TestRunner.mockDocumentMethod;
const mockElementMethod = TestRunner.mockElementMethod;
const mockPrototypeMethod = TestRunner.mockPrototypeMethod;
