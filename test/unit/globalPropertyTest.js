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

describe('ESFive global properties', function () {
    describe('defining accessor properties on global object via "window"', function () {
        var definesCode = nowdoc(function () {/*<<<EOS
var name;

Object.defineProperties(window, {
    me: {
        get: function () {
            return 'My name is ' + name;
        },
        set: function (value) {
            name = value;
        }
    },
    him: {
        get: function () {
            return 'His name is ' + name;
        },
        set: function (value) {
            name = value;
        }
    }
});

EOS
*/;}); // jshint ignore:line

        _.each({
            'then using via "window"': {
                code: definesCode + nowdoc(function () {/*<<<EOS
window.me = 'Dan';
return window.me;
EOS
*/;}), // jshint ignore:line
                expectedResult: 'My name is Dan'
            },
            'then using via "this"': {
                code: definesCode + nowdoc(function () {/*<<<EOS
this.him = 'Fred';
return this.him;
EOS
*/;}), // jshint ignore:line
                expectedResult: 'His name is Fred'
            },
            'then reading as global variable as return argument': {
                code: definesCode + nowdoc(function () {/*<<<EOS
me = 'Dan';
return me;
EOS
*/;}), // jshint ignore:line
                expectedResult: 'My name is Dan'
            },
            'then reading as global variable in right operand of assignment expression': {
                code: definesCode + nowdoc(function () {/*<<<EOS
me = 'Dan';
var who;
who = me;
return '"' + who + '"';
EOS
*/;}), // jshint ignore:line
                expectedResult: '"My name is Dan"'
            },
            'then reading as global variable in initializer of variable declarator': {
                code: definesCode + nowdoc(function () {/*<<<EOS
me = 'Dan';
var who = me;
return '"' + who + '"';
EOS
*/;}), // jshint ignore:line
                expectedResult: '"My name is Dan"'
            },
            'then reading as global variable in left and right operands of binary expression': {
                code: definesCode + nowdoc(function () {/*<<<EOS
me = 'Dan';
return me + (', yes, ' + me);
EOS
*/;}), // jshint ignore:line
                expectedResult: 'My name is Dan, yes, My name is Dan'
            },
            'then reading as global variable in element of array literal when avoiding index property lookup': {
                code: definesCode + nowdoc(function () {/*<<<EOS
him = 'John';
var array = [him];
return array + ', yes';
EOS
*/;}), // jshint ignore:line
                expectedResult: 'His name is John, yes'
            }
        }, tools.check);
    });

    describe('defining accessor property on global object via "window"', function () {
        _.each({
            'then reading as value for array literal element should call getter': {
                code: nowdoc(function () {/*<<<EOS
var result;

Object.defineProperty(window, 'getIt', {
    get: function () {
        result = 7;
    }
});

[getIt];

return result;
EOS
*/;}), // jshint ignore:line
                expectedResult: 7
            },
            'then reading as initializer for value for property in object literal should call getter': {
                code: nowdoc(function () {/*<<<EOS
var result;

Object.defineProperty(window, 'getIt', {
    get: function () {
        result = 7;
    }
});

({prop: getIt});

return result;
EOS
*/;}), // jshint ignore:line
                expectedResult: 7
            },
            'then reading as argument value in function call should call getter': {
                code: nowdoc(function () {/*<<<EOS
var result;

Object.defineProperty(window, 'getIt', {
    get: function () {
        result = 7;
    }
});

function emptyFunc() {}
emptyFunc(getIt);

return result;
EOS
*/;}), // jshint ignore:line
                expectedResult: 7
            },
            'then reading as function to call should call getter': {
                code: nowdoc(function () {/*<<<EOS
var result;

Object.defineProperty(window, 'getIt', {
    get: function () {
        result = 6;
        return function () {}
    }
});

getIt();

return result;
EOS
*/;}), // jshint ignore:line
                expectedResult: 6
            },
            'then reading as argument value in method call should call getter': {
                code: nowdoc(function () {/*<<<EOS
var result;

Object.defineProperty(window, 'getIt', {
    get: function () {
        result = 7;
    }
});

({emptyMethod: function () {}}).emptyMethod(getIt);

return result;
EOS
*/;}), // jshint ignore:line
                expectedResult: 7
            },
            'then using as operand to unary expression': {
                code: nowdoc(function () {/*<<<EOS
Object.defineProperty(window, 'getIt', {
    get: function () {
        return 1;
    }
});

return ~getIt;
EOS
*/;}), // jshint ignore:line
                expectedResult: -2
            }
        }, tools.check);
    });

    describe('without defining any properties on the global object', function () {
        _.each({
            'method call argument referencing local variable should work correctly': {
                code: nowdoc(function () {/*<<<EOS
return (function () {
    var number = 6;

    return (function (result) {
        return result;
    }(number));
}());
EOS
*/;}), // jshint ignore:line
                expectedResult: 6
            },
            'storing argument in array literal element should work correctly': {
                code: nowdoc(function () {/*<<<EOS
return (function (result) {
    return [result];
}(6))[0];
EOS
*/;}), // jshint ignore:line
                expectedResult: 6
            },
            'returning local variable as function result, referencing before definition': {
                code: nowdoc(function () {/*<<<EOS
return [(function () {
    result = 7;
    return result;

    var result;
}()), result];
EOS
*/;}), // jshint ignore:line
                expectedResultDeep: true,
                // Make sure 'result' is not defined as a global
                expectedResult: [7, undefined]
            },
            'returning result of call to local function as function result, referencing before definition': {
                code: nowdoc(function () {/*<<<EOS
return (function () {
    return getResult();

    function getResult() {
        return 6;
    }
}());
EOS
*/;}), // jshint ignore:line
                expectedResult: 6
            },
            'storing reference to function in variable, referencing before definition': {
                code: nowdoc(function () {/*<<<EOS
return (function () {
    var func = getResult;
    return func();

    function getResult() {
        return 6;
    }
}());
EOS
*/;}), // jshint ignore:line
                expectedResult: 6
            },
            'returning caught error as result': {
                code: nowdoc(function () {/*<<<EOS
try { throw 5; } catch (result) {
    return result;
}
EOS
*/;}), // jshint ignore:line
                expectedResult: 5
            },
            'creating data property of global object (only in sloppy mode) by assigning to undefined variable, then reading back via "window"': {
                code: nowdoc(function () {/*<<<EOS
myResult = 7;

return window.myResult;
EOS
*/;}), // jshint ignore:line
                expectedResult: 7
            }
        }, tools.check);
    });
});
