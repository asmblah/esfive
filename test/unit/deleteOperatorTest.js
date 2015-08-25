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

describe('ESFive delete operator', function () {
    _.each({
        'deleting builtin values should return true even though it has no effect': {
            code: nowdoc(function () {/*<<<EOS
return [
    delete 6,
    delete 'world',
    delete true,
    delete false,
    delete null
];
EOS
*/;}), // jshint ignore:line
            expectedResultDeep: true,
            expectedResult: [true, true, true, true, true]
        },
        'deleting a configurable property of an object should return true': {
            code: nowdoc(function () {/*<<<EOS
var myObject = {};
myObject.myProp = 7;

return delete myObject.myProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: true
        },
        'trying to delete a non-configurable property of an object should return false': {
            code: nowdoc(function () {/*<<<EOS
var myObject = {};
Object.defineProperty(myObject, 'myProp', {
    configurable: false,
    value: 7
});

return delete myObject.myProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: false
        },
        'deleting a configurable property of an object should leave it undefined': {
            code: nowdoc(function () {/*<<<EOS
var myObject = {};
myObject.myProp = 7;
delete myObject.myProp;

return typeof myObject.myProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: 'undefined'
        },
        'trying to delete a non-configurable property of an object should not undefine it': {
            code: nowdoc(function () {/*<<<EOS
var myObject = {};
Object.defineProperty(myObject, 'myProp', {
    configurable: false,
    value: 4
});
delete myObject.myProp;

return myObject.myProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: 4
        },
        'deleting a configurable property of an object should remove it from the object': {
            code: nowdoc(function () {/*<<<EOS
var myObject = {};
myObject.myProp = 7;
delete myObject.myProp;

return myObject.hasOwnProperty('myProp');
EOS
*/;}), // jshint ignore:line
            expectedResult: false
        },
        'deleting a configurable property that shadows a non-configurable one should return true': {
            code: nowdoc(function () {/*<<<EOS
var myParentObject = {};
Object.defineProperty(myParentObject, 'myProp', {
    configurable: false,
    value: 4
});
var myChildObject = Object.create(myParentObject);
Object.defineProperty(myChildObject, 'myProp', {
    configurable: true,
    value: 5
});

return delete myChildObject.myProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: true
        },
        'deleting a configurable property that shadows a non-configurable one should not modify the shadowed property': {
            code: nowdoc(function () {/*<<<EOS
var myParentObject = {};
Object.defineProperty(myParentObject, 'myProp', {
    configurable: false,
    value: 4
});
var myChildObject = Object.create(myParentObject);
Object.defineProperty(myChildObject, 'myProp', {
    configurable: true,
    value: 5
});
delete myChildObject.myProp;

// Deliberately read the property of the parent object
return myParentObject.myProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: 4
        },
        'deleting a configurable property with computed lookup when property name is a variable value should return true': {
            code: nowdoc(function () {/*<<<EOS
var myObject = {
        myProp: 'a prop'
    },
    myName = 'myProp';

return delete myObject[myName];
EOS
*/;}), // jshint ignore:line
            expectedResult: true
        },
        'trying to delete a non-configurable property with computed lookup when property name is a variable value should return false': {
            code: nowdoc(function () {/*<<<EOS
var myObject = {},
    myName = 'myProp';

Object.defineProperty(myObject, 'myProp', {
    configurable: false,
    value: 'a prop'
});

return delete myObject[myName];
EOS
*/;}), // jshint ignore:line
            expectedResult: false
        },
        'deleting a configurable property with computed lookup when property name is a variable value should leave it undefined': {
            code: nowdoc(function () {/*<<<EOS
var myObject = {
        myProp: 'a prop'
    },
    myName = 'myProp';

delete myObject[myName];

return typeof myObject.myProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: 'undefined'
        },
        'trying to delete a non-configurable property with computed lookup when property name is a variable value should not undefine it': {
            code: nowdoc(function () {/*<<<EOS
var myObject = {},
    myName = 'myProp';

Object.defineProperty(myObject, 'myProp', {
    configurable: false,
    value: 'a prop'
});

delete myObject[myName];

return myObject.myProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: 'a prop'
        },
        'deleting a configurable property with computed lookup when property name is a string literal should return true': {
            code: nowdoc(function () {/*<<<EOS
var myObject = {
        myProp: 'a prop'
    };

return delete myObject['myProp'];
EOS
*/;}), // jshint ignore:line
            expectedResult: true
        },
        'trying to delete a non-configurable property with computed lookup when property name is a string literal should return false': {
            code: nowdoc(function () {/*<<<EOS
var myObject = {};

Object.defineProperty(myObject, 'myProp', {
    configurable: false,
    value: 'a prop'
});

return delete myObject['myProp'];
EOS
*/;}), // jshint ignore:line
            expectedResult: false
        },
        'deleting a configurable property with computed lookup when property name is a string literal should leave it undefined': {
            code: nowdoc(function () {/*<<<EOS
var myObject = {
        myProp: 'a prop'
    };

delete myObject['myProp'];

return typeof myObject.myProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: 'undefined'
        },
        'trying to delete a non-configurable property with computed lookup when property name is a string literal should not undefine it': {
            code: nowdoc(function () {/*<<<EOS
var myObject = {};

Object.defineProperty(myObject, 'myProp', {
    configurable: false,
    value: 'a prop'
});

delete myObject['myProp'];

return myObject.myProp;
EOS
*/;}), // jshint ignore:line
            expectedResult: 'a prop'
        },
        'deleting a local variable should return false': {
            code: nowdoc(function () {/*<<<EOS
return (function () {
    var myVar = 8;

    return delete myVar;
}());
EOS
*/;}), // jshint ignore:line
            expectedResult: false
        },
        'deleting a local variable should not undefine it': {
            code: nowdoc(function () {/*<<<EOS
return (function () {
    var myVar = 9;
    delete myVar;

    return myVar;
}());
EOS
*/;}), // jshint ignore:line
            expectedResult: 9
        },
        'deleting a local function should return false': {

        },
        'deleting a local function should not undefine it': {

        }
    }, tools.check);
});
