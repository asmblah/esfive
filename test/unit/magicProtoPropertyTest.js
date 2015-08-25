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
    tools = require('./tools'),
    undef;

describe('ESFive magic __proto__ property', function () {
    _.each({
        'read of __proto__ from object literal without __proto__ should give Object.prototype': {
            code: 'debugger;return {}.__proto__ === Object.prototype;',
            expectedResult: true
        },
        'read of __proto__ from result of Object.create(...) should give the prototype object': {
            code: nowdoc(function () {/*<<<EOS
var object = {me: 'Dan'};
return Object.create(object).__proto__ === object;
EOS
*/;}), // jshint ignore:line
            expectedResult: true
        },
        'setting __proto__ should remove access to previously inherited properties that are no longer inherited': {
            code: nowdoc(function () {/*<<<EOS
var object = Object.create({myName: 'Dan'});
object.__proto__ = {};
return object.myName;
EOS
*/;}), // jshint ignore:line
            expectedResult: undef
        },
        'setting __proto__ should remove access for inheritors to previously inherited properties that are no longer inherited': {
            code: nowdoc(function () {/*<<<EOS
var object = Object.create({myName: 'Dan'});
object.__proto__ = {};
return Object.create(object).myName;
EOS
*/;}), // jshint ignore:line
            expectedResult: undef
        },
        'setting __proto__ should remove access to previously inherited method properties that are no longer inherited': {
            code: nowdoc(function () {/*<<<EOS
var object = Object.create({
    getMyName: function () {
        return 'Dan';
    }
});
object.__proto__ = {};
return object.getMyName();
EOS
*/;}), // jshint ignore:line
            expectedError: true
        },
        'setting __proto__ should remove access for inheritors to previously inherited method properties that are no longer inherited': {
            code: nowdoc(function () {/*<<<EOS
var object = Object.create({
    getMyName: function () {
        return 'Dan';
    }
});
object.__proto__ = {};
return Object.create(object).getMyName();
EOS
*/;}), // jshint ignore:line
            expectedError: true
        },
        'setting __proto__ should grant access to newly inherited properties': {
            code: nowdoc(function () {/*<<<EOS
var object = Object.create({myName: 'Dan'});
object.__proto__ = {
    yourName: 'Fred'
};
return object.yourName;
EOS
*/;}), // jshint ignore:line
            expectedResult: 'Fred'
        },
        'setting __proto__ should grant access for inheritors to newly inherited properties': {
            code: nowdoc(function () {/*<<<EOS
var object = Object.create({myName: 'Dan'});
object.__proto__ = {
    yourName: 'Fred'
};
return Object.create(object).yourName;
EOS
*/;}), // jshint ignore:line
            expectedResult: 'Fred'
        },
        'setting __proto__ should grant access to newly inherited method properties': {
            code: nowdoc(function () {/*<<<EOS
var object = Object.create({
    getMyName: function () {
        return 'Dan';
    }
});
object.__proto__ = {
    getYourName: function () {
        return 'Fred'
    }
};
return object.getYourName();
EOS
*/;}), // jshint ignore:line
            expectedResult: 'Fred'
        },
        'setting __proto__ should grant access for inheritors to newly inherited method properties': {
            code: nowdoc(function () {/*<<<EOS
var object = Object.create({
    getMyName: function () {
        return 'Dan';
    }
});
object.__proto__ = {
    getYourName: function () {
        return 'Fred'
    }
};
return Object.create(object).getYourName();
EOS
*/;}), // jshint ignore:line
            expectedResult: 'Fred'
        },
        'setting __proto__ should not affect access to own properties': {
            code: nowdoc(function () {/*<<<EOS
var object = {firstName: 'George', lastName: 'Smith'}
// The property inherited from the new [[Prototype]] should not override the own property
object.__proto__ = {
    lastName: 'Georgeson'
};
return object.firstName + ' ' + object.lastName;
EOS
*/;}), // jshint ignore:line
            expectedResult: 'George Smith'
        },
        'setting __proto__ should not affect access to own method properties': {
            code: nowdoc(function () {/*<<<EOS
var object = {
    getFirstName: function () {
        return 'George';
    },
    getLastName: function () {
        return 'Smith';
    }
};
// The property inherited from the new [[Prototype]] should not override the own property
object.__proto__ = {
    getLastName: function () {
        return 'Georgeson';
    }
};
return object.getFirstName() + ' ' + object.getLastName();
EOS
*/;}), // jshint ignore:line
            expectedResult: 'George Smith'
        },
        'object with data method property inherited via prototype chain after redirection with __proto__ should set the "this" object correctly': {
            code: nowdoc(function () {/*<<<EOS
var ancestor = {},
    inheritor = {},
    thisObject;

Object.defineProperty(ancestor, 'getThis', {
    writable: false,
    value: function () {
        thisObject = this;
    }
});

inheritor.__proto__ = ancestor;

inheritor.getThis();
return thisObject === inheritor;
EOS
*/;}), // jshint ignore:line
            expectedResult: true
        },
        'multiple levels of __proto__ redirection': {
            code: nowdoc(function () {/*<<<EOS
var nativeObject = {},
    wrappedObject = {};

wrappedObject.__proto__ = nativeObject;

wrappedObject = Object.create(wrappedObject);

nativeObject.__proto__ = {
    getComputedStyle: function () {
        return 7;
    }
};

return wrappedObject.getComputedStyle();
EOS
*/;}), // jshint ignore:line
            expectedResult: 7
        }
    }, tools.check);
});
