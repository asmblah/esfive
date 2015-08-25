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

describe('ESFive with {...} statement', function () {
    _.each({
        'data property of scope object should be returned': {
            code: nowdoc(function () {/*<<<EOS
with ({age: 24}) {
    return age;
}
EOS
*/;}), // jshint ignore:line
            expectedResult: 24
        },
        'data property of scope object should not be returned when no longer inherited after redirection inside block': {
            code: nowdoc(function () {/*<<<EOS
var age = 20,
    object = Object.create({age: 24});

with (object) {
    object.__proto__ = {};
    debugger;
    return age;
}
EOS
*/;}), // jshint ignore:line
            // The inherited 'age' property should no longer be accessible, so the 'age' variable
            // defined in the scope enclosing the 'with {...}' should be used instead.
            expectedResult: 20
        },
        'reference should skip scope object that does not define, then variable should shadow property of a parent scope object': {
            code: nowdoc(function () {/*<<<EOS
with ({result: 3}) {
    return (function () {
        var result = 27;
        with ({}) {
            return result;
        }
    }());
}
EOS
*/;}), // jshint ignore:line
            expectedResult: 27
        },
        'defining property with referenced variable name inside the inner "with {...}"': {
            code: nowdoc(function () {/*<<<EOS
with ({result: 3}) {
    return (function () {
        var result = 27,
            scope = {};
        with (scope) {
            scope.result = 4;
            return result;
        }
    }());
}
EOS
*/;}), // jshint ignore:line
            expectedResult: 4
        },
        'property defined on scope object should override scope object variable with same name': {
            code: nowdoc(function () {/*<<<EOS
var stuff = {
    stuff: 5
};

with (stuff) {
    return stuff;
}
EOS
*/;}), // jshint ignore:line
            expectedResult: 5
        },
        'property defined on scope object with value "undefined" should not be overridden by variable above': {
            code: nowdoc(function () {/*<<<EOS
var myResult = 'Wrong',
    object = {
        myResult: undefined
    };

with (object) {
    return myResult;
}
EOS
*/;}), // jshint ignore:line
            expectedResult: undef
        },
        'property defined on scope object with value "undefined" should not be overridden by scope object above': {
            code: nowdoc(function () {/*<<<EOS
var myResult = 'Wrong',
    object = {
        myResult: 4
    },
    otherObject = {
        myResult: undefined
    };

with (object) {
    with (otherObject) {
        return myResult;
    }
}
EOS
*/;}), // jshint ignore:line
            expectedResult: undef
        },
        'property not defined on inner scope object, only on outer scope object': {
            code: nowdoc(function () {/*<<<EOS
var myResult = 'Wrong',
    object = {
        myResult: 4
    },
    otherObject = {};

with (object) {
    with (otherObject) {
        return myResult;
    }
}
EOS
*/;}), // jshint ignore:line
            expectedResult: 4
        },
        'assignment to variable with name defined only on scope object as accessor should call the setter correctly': {
            code: nowdoc(function () {/*<<<EOS
var object = {},
    result;

Object.defineProperty(object, 'answer', {
    set: function (value) {
        result = value;
    }
});

with (object) {
    answer = 5;
}

return result;
EOS
*/;}), // jshint ignore:line
            expectedResult: 5
        },
        'assignment to variable with name defined as variable in enclosing scope and on scope object as accessor': {
            code: nowdoc(function () {/*<<<EOS
var answer = 2,
    object = {},
    result;

Object.defineProperty(object, 'answer', {
    set: function (value) {
        result = value;
    }
});

with (object) {
    answer = 5;
}

return result;
EOS
*/;}), // jshint ignore:line
            expectedResult: 5
        },
        'assignment to variable with name defined as variable in enclosing scope, not on scope object': {
            code: nowdoc(function () {/*<<<EOS
var answer = 2,
    object = {};

with (object) {
    answer = 5;
}

return answer;
EOS
*/;}), // jshint ignore:line
            expectedResult: 5
        },
        'variable should not be affected by "with {...}" statements in nested scopes': {
            code: nowdoc(function () {/*<<<EOS
var myAge = 24;

(function () {
    with ({}) {
        yourAge = 23;
    }
}());

return myAge;
EOS
*/;}), // jshint ignore:line
            expectedResult: 24
        }
    }, tools.check);
});
