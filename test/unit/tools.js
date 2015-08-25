/*
 * ESFive - ES5-to-ES3 transpiler
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/esfive
 *
 * Released under the MIT license
 * https://github.com/asmblah/esfive/raw/master/MIT-LICENSE.txt
 */

'use strict';

var _ = require('lodash'),
    environment = require('../../src/environment'),
    Hash = environment.Hash,
    createStubLocalStorage = function () {
        var storage = new Hash();

        return {
            getItem: function (name) {
                return (name in storage) ? storage[name] : null;
            },
            setItem: function (name, value) {
                storage[name] = value;
            }
        };
    },
    PROTO = '__proto__',
    ESFive = require('../../src/ESFive');

module.exports = {
    check: function (scenario, description) {
        describe(description, function () {
            var code,
                esFive,
                result,
                resultError = null,
                sandboxDocument,
                sandboxIframe,
                sandboxScope;

            beforeEach(function () {
                // Make sure we don't use the native implementation for these tests
                esFive = new ESFive(createStubLocalStorage(), {useNative: false});
                sandboxIframe = document.createElement('iframe');
                (document.body || document).appendChild(sandboxIframe);
                sandboxDocument = sandboxIframe.contentWindow.document;

                sandboxDocument.open();
                sandboxDocument.write('<script>document.scope = window;</script>');
                sandboxDocument.close();
                sandboxScope = sandboxDocument.scope;

                // In environments with native ES5 (therefore probably non-standard __proto__ support),
                // the native accessor __proto__ property will interfere with ESFive's emulation
                if (environment.isES5) {
                    delete sandboxScope.Object.prototype[PROTO];
                }

                esFive.applyToScope(sandboxScope, {
                    allowedGlobals: scenario.allowedGlobals || ['window']
                });

                code = esFive.transpile('(function () {\n' + scenario.code + '\n}())', {
                    sourceUri: scenario.sourceUri
                });
            });

            afterEach(function () {
                sandboxIframe.parentNode.removeChild(sandboxIframe);
                code = esFive = result = resultError = sandboxDocument = sandboxIframe = sandboxScope = null;
            });

            function run() {
                var script;

                esFive.on('error', function (error) {
                    resultError = error;
                });

                /*jshint evil:true */
                script = sandboxDocument.createElement('script');
                script.text = 'window.__result__ = (function () { return ' + code + '; }());';
                sandboxDocument.body.appendChild(script);
                sandboxDocument.body.removeChild(script);
                //result = sandboxScope.eval(code);

                if (resultError !== null) {
                    throw resultError;
                }

                result = sandboxScope.__result__;
            }

            if (scenario.hasOwnProperty('expectedError')) {
                it('should throw the expected error', function () {
                    expect(run).to.throw();
                });
            } else if (scenario.hasOwnProperty('expectedResultDeep')) {
                it('should return the correct result', function () {
                    run();

                    expect(result).to.deep.equal(scenario.expectedResult);
                });
            } else if (scenario.hasOwnProperty('expectedResult')) {
                it('should return the correct result', function () {
                    run();

                    expect(result).to.equal(scenario.expectedResult);
                });
            }

            _.forOwn(scenario.expectedGlobals, function (expectedValue, name) {
                it('should set the "' + name + '" global to the correct value', function () {
                    run();

                    expect(sandboxScope[name]).to.equal(expectedValue);
                });
            });
        });
    }
};
