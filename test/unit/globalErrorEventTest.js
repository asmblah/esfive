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
    nowdoc = require('nowdoc'),
    tools = require('./tools');

describe('ESFive global error event - window.onerror', function () {
    _.each({
        'triggering a TypeError to be thrown by trying to call undefined in global scope': {
            code: nowdoc(function () {/*<<<EOS
var fn;
window.onerror = function () {
    window.errorCaught = true;
    return true;
};
fn(); // Call an undefined function

EOS
*/;}), // jshint ignore:line
            expectedGlobals: {
                errorCaught: true
            }
        }
    }, tools.check);
});
