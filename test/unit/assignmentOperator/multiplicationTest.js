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

describe('ESFive multiplication-assignment operator tests', function () {
    _.each({
        'using with object data property': {
            code: nowdoc(function () {/*<<<EOS
var object = {
    val: 4
};

object.val *= 3;

return object.val;
EOS
*/;}), // jshint ignore:line
            expectedResult: 12
        },
        'using with object accessor property': {
            code: nowdoc(function () {/*<<<EOS
var object = {},
    result;

Object.defineProperty(object, 'val', {
    get: function () {
        return 5;
    },
    set: function (newVal) {
        result = newVal;
    }
});

object.val *= 3;

return result;
EOS
*/;}), // jshint ignore:line
            expectedResult: 15
        },
        'using with data property of global object': {
            code: nowdoc(function () {/*<<<EOS
// Assigning to undeclared identifier (in sloppy mode) creates a property on global object
result = 7;

result *= 2;

return result;
EOS
*/;}), // jshint ignore:line
            expectedResult: 14
        },
        'using with accessor property of global object': {
            code: nowdoc(function () {/*<<<EOS
var result;

Object.defineProperty(this, 'val', {
    get: function () {
        return 6;
    },
    set: function (newVal) {
        result = newVal;
    }
});

val *= 5;

return result;
EOS
*/;}), // jshint ignore:line
            expectedResult: 30
        }
    }, tools.check);
});
