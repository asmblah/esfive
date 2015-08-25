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

describe('ESFive for..in loop', function () {
    _.each({
        'loop over object with one non-enumerable property': {
            code: nowdoc(function () {/*<<<EOS
var key,
    keys = [],
    object = {};

Object.defineProperty(object, 'secret', {
    enumerable: false,
    value: 21
});

for (key in object) {
    keys.push(key);
}

return keys.length;
EOS
*/;}), // jshint ignore:line
            expectedResult: 0
        },
        'loop over object with one non-enumerable property, with loop inside a function call argument': {
            code: nowdoc(function () {/*<<<EOS
var key,
    keys = [],
    object = {};

Object.defineProperty(object, 'secret', {
    enumerable: false,
    value: 21
});
(function (doIt) {
    doIt();
}(function () {
    for (key in object) {
        keys.push(key);
    }
}));

return keys.length;
EOS
*/;}), // jshint ignore:line
            expectedResult: 0
        },
        'loop over object with two enumerable and two non-enumerable data properties': {
            code: nowdoc(function () {/*<<<EOS
var key,
    keys = [],
    object = {};

Object.defineProperties(object, {
    enum1: {
        enumerable: true,
        value: 6
    },
    nonEnum1: {
        enumerable: false,
        value: 7
    },
    enum2: {
        enumerable: true,
        value: 8
    },
    nonEnum2: {
        enumerable: false,
        value: 9
    }
});

for (key in object) {
    keys.push(key);
}

return keys;
EOS
*/;}), // jshint ignore:line
            expectedResultDeep: true,
            expectedResult: ['enum1', 'enum2']
        }
    }, tools.check);
});
