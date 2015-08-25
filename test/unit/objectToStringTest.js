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

describe('ESFive Object.toString() support', function () {
    _.each({
        'calling a custom .toString() method (defined via data property) of an object natively via coercion': {
            allowedGlobals: [],
            code: nowdoc(function () {/*<<<EOS
var object = {
    toString: function () {
        return 'the result';
    }
};

return object + '';
EOS
*/;}), // jshint ignore:line
            expectedResult: 'the result'
        },
        'calling a custom .toString() method (defined via accessor property) of an object natively via coercion': {
            allowedGlobals: [],
            code: nowdoc(function () {/*<<<EOS
var object = {};

Object.defineProperty(object, 'toString', {
    get: function () {
        return function () {
            return 'the result';
        };
    }
});

return object + '';
EOS
*/;}), // jshint ignore:line
            expectedResult: 'the result'
        }
    }, tools.check);
});
