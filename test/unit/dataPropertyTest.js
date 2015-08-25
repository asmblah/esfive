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

describe('ESFive data properties', function () {
    _.each({
        'simple assignment to then read from static data property (ES3)': {
            code: nowdoc(function () {/*<<<EOS
var object = {};
object.stuff = 'Some stuff';
return object.stuff;

EOS
*/;}), // jshint ignore:line
            expectedResult: 'Some stuff'
        },
        'simple assignment to then read from computed data property (ES3)': {
            code: nowdoc(function () {/*<<<EOS
var object = {};
object['stuff'] = 'Some other stuff';
return object['stuff'];

EOS
*/;}), // jshint ignore:line
            expectedResult: 'Some other stuff'
        },
        'simple assignment to then read from computed (via variable) data property (ES3)': {
            code: nowdoc(function () {/*<<<EOS
var name = 'stuff',
    object = {};
object[name] = 'Some other stuff';
return object[name];

EOS
*/;}), // jshint ignore:line
            expectedResult: 'Some other stuff'
        },
        'result of assignment to data property (ES3) should return the value': {
            code: nowdoc(function () {/*<<<EOS
var object = {};
return (object.stuff = 'More stuff');

EOS
*/;}), // jshint ignore:line
            expectedResult: 'More stuff'
        },
        'calling Function.prototype.call(...) when non-writable data property was defined with Object.defineProperty(...)': {
            code: nowdoc(function () {/*<<<EOS
var object = {};

Object.defineProperty(object, 'func', {
    writable: false,
    value: function () {
        return this.name;
    }
});

return object.func.call({
    name: 'Dan'
});

EOS
*/;}), // jshint ignore:line
            expectedResult: 'Dan'
        },
        'calling Function.prototype.apply(...) when non-writable data property was defined with Object.defineProperty(...)': {
            code: nowdoc(function () {/*<<<EOS
var object = {};

Object.defineProperty(object, 'func', {
    writable: false,
    value: function () {
        return this.name;
    }
});

return object.func.apply({
    name: 'Dan'
});

EOS
*/;}), // jshint ignore:line
            expectedResult: 'Dan'
        },
        'object with data method property inherited via prototype chain should set the "this" object correctly': {
            code: nowdoc(function () {/*<<<EOS
var inheritor,
    object = {},
    thisObject;

Object.defineProperty(object, 'getThis', {
    writable: false,
    value: function () {
        thisObject = this;
    }
});

inheritor = Object.create(object);
inheritor.getThis();
return thisObject === inheritor;

EOS
*/;}), // jshint ignore:line
            expectedResult: true
        },
        'assignment to writable own data property in sloppy mode should succeed': {
            code: nowdoc(function () {/*<<<EOS
var object = {};

Object.defineProperty(object, 'aValue', {
    writable: true,
    value: 2
});

object.aValue = 4;

return object.aValue;
EOS
*/;}), // jshint ignore:line
            expectedResult: 4
        },
        'assignment to read-only own data property in sloppy mode should be ignored': {
            code: nowdoc(function () {/*<<<EOS
var object = {};

Object.defineProperty(object, 'aValue', {
    writable: false,
    value: 2
});

object.aValue = 4;

return object.aValue;
EOS
*/;}), // jshint ignore:line
            expectedResult: 2
        }
    }, tools.check);
});
