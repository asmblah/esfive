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
    tools = require('../tools');

describe('ESFive Error.stack', function () {
    _.each({
        'reading Error.stack in global scope': {
            sourceUri: 'abc/123.js',
            code: nowdoc(function () {/*<<<EOS
return new Error().stack;

EOS
*/;}), // jshint ignore:line
            expectedResult: nowdoc(function () {/*<<<EOS
Error
    at abc/123.js:2:8
    at abc/123.js:4:2
EOS
*/;}) // jshint ignore:line
        },
        'reading Error.stack in global scope after function call': {
            code: nowdoc(function () {/*<<<EOS
function doNothing() {}
doNothing();

return new Error().stack;

EOS
*/;}), // jshint ignore:line
            expectedResult: nowdoc(function () {/*<<<EOS
Error
    at <anonymous>:5:8
    at <anonymous>:7:2
EOS
*/;}) // jshint ignore:line
        },
        'writing to Error.stack should be allowed': {
            code: nowdoc(function () {/*<<<EOS
var error = new Error();
error.stack = 21;

return error.stack;
EOS
*/;}), // jshint ignore:line
            expectedResult: 21
        },
        'reading Error.stack in local scope': {
            code: nowdoc(function () {/*<<<EOS
return (function myFunc() {
    return new Error().stack;
}());
EOS
*/;}), // jshint ignore:line
            expectedResult: nowdoc(function () {/*<<<EOS
Error
    at myFunc (<anonymous>:3:12)
    at <anonymous>:4:2
    at <anonymous>:5:2
EOS
*/;}) // jshint ignore:line
        },
        'ReferenceError thrown in local scope when trying to call undefined variable': {
            code: nowdoc(function () {/*<<<EOS
return (function myFunc() {
    try {
        a();
    } catch (error) {
        return error.stack;
    }
}());
EOS
*/;}), // jshint ignore:line
            expectedResult: nowdoc(function () {/*<<<EOS
ReferenceError: a is not defined
    at myFunc (<anonymous>:4:9)
    at <anonymous>:8:2
    at <anonymous>:9:2
EOS
*/;}) // jshint ignore:line
        }
    }, tools.check);
});
