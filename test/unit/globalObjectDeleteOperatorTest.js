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

describe('ESFive delete operator integration with the global object', function () {
    _.each({
        'deleting an identifier that is not a global variable or property of the global object should return true': {
            code: 'return delete anUndeclaredIdentifier;',
            expectedResult: true
        },
        'deleting a string literal should not undefine a configurable property of the global object with the same name': {
            code: nowdoc(function () {/*<<<EOS
myGlobalProp = 4;

delete 'myGlobalProp';

return myGlobalProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: 4
        },
        'deleting a configurable property of the global object should return true': {
            code: nowdoc(function () {/*<<<EOS
myGlobalProp = 7;

return delete myGlobalProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: true
        },
        'deleting a configurable property of the global object for a second time should return true': {
            code: nowdoc(function () {/*<<<EOS
myGlobalProp = 7;

// Deliberately delete the property twice
delete myGlobalProp;

return delete myGlobalProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: true
        },
        'trying to delete a non-configurable property of the global object should return false': {
            code: nowdoc(function () {/*<<<EOS
Object.defineProperty(this, 'myGlobalProp', {
    configurable: false,
    value: 7
});

return delete myGlobalProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: false
        },
        'deleting a configurable property of the global object should leave it undefined': {
            code: nowdoc(function () {/*<<<EOS
myGlobalProp = 7;
delete myGlobalProp;
return typeof myGlobalProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: 'undefined'
        },
        'trying to delete a non-configurable property of the global object should not undefine it': {
            code: nowdoc(function () {/*<<<EOS
Object.defineProperty(this, 'myGlobalProp', {
    configurable: false,
    value: 4
});
delete myGlobalProp;

return myGlobalProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: 4
        },
        'deleting a configurable property of the global object should remove it from the global object': {
            code: nowdoc(function () {/*<<<EOS
myGlobalProp = 7;
delete myGlobalProp;

return this.hasOwnProperty('myGlobalProp');
EOS
*/;}), // jshint ignore:line
            expectedResult: false
        },
        'deleting a global variable should return false': {
            code: nowdoc(function () {/*<<<EOS
var myGlobalVar = 8;

return delete myGlobalVar;
EOS
*/;}), // jshint ignore:line
            expectedResult: false
        },
        'deleting a global variable should not undefine it': {
            code: nowdoc(function () {/*<<<EOS
var myGlobalVar = 9;
delete myGlobalVar;

return myGlobalVar;
EOS
*/;}), // jshint ignore:line
            expectedResult: 9
        }
    }, tools.check);
});
