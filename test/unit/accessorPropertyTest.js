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

describe('ESFive accessor properties', function () {
    _.each({
        'simple object accessor property with getter': {
            code: nowdoc(function () {/*<<<EOS
var object = {},
    title = 'This is the title';

Object.defineProperty(object, 'title', {
    get: function () {
        return title;
    }
});

return object.title;

EOS
*/;}), // jshint ignore:line
            expectedResult: 'This is the title'
        },
        'simple object accessor property with setter': {
            code: nowdoc(function () {/*<<<EOS
var object = {},
    result;

Object.defineProperty(object, 'title', {
    set: function (value) {
        result = value;
    }
});

object.title = 'This is another title';

return result;

EOS
*/;}), // jshint ignore:line
            expectedResult: 'This is another title'
        },
        'object with accessor property inherited via prototype chain': {
            code: nowdoc(function () {/*<<<EOS
var create = function (from) {
        function F() {}
        F.prototype = from;
        return new F();
    },
    object,
    funkiness;

function FunkyBase() {}
function FunkySub() {}
FunkySub.prototype = create(FunkyBase.prototype);

object = new FunkySub();

Object.defineProperty(FunkyBase.prototype, 'funky', {
    get: function () {
        return 'and ' + funkiness;
    },
    set: function (value) {
        funkiness = 'then some ' + value;
    }
});

object.funky = 'more';

return object.funky;

EOS
*/;}), // jshint ignore:line
            expectedResult: 'and then some more'
        },
        // Make sure we don't pass the .prototype object as the 'this' object
        'object with accessor property inherited via prototype chain should set the "this" object correctly in getter and setter': {
            code: nowdoc(function () {/*<<<EOS
var create = function (from) {
        function F() {}
        F.prototype = from;
        return new F();
    },
    getterThisObject,
    object,
    setterThisObject;

function FunkyBase() {}
function FunkySub() {}
FunkySub.prototype = create(FunkyBase.prototype);

object = new FunkySub();

Object.defineProperty(FunkyBase.prototype, 'funky', {
    get: function () {
        getterThisObject = this;
    },
    set: function () {
        setterThisObject = this;
    }
});

object.identifier = 'This one';
object.funky;
object.funky = 6;

return {
    getterThisObjectIdentifier: getterThisObject.identifier,
    setterThisObjectIdentifier: setterThisObject.identifier
};

EOS
*/;}), // jshint ignore:line
            expectedResultDeep: true,
            expectedResult: {
                getterThisObjectIdentifier: 'This one',
                setterThisObjectIdentifier: 'This one'
            }
        },
        'property lookup chain including getter that returns a function': {
            code: nowdoc(function () {/*<<<EOS
var firstMember = {},
    firstPerson = {},
    members = {},
    name = 'Dan';

Object.defineProperty(members, 'first', {
    get: function () {
        return firstMember;
    }
});

Object.defineProperty(firstMember, 'getPerson', {
    get: function () {
        return function () {
            return firstPerson;
        };
    }
});

Object.defineProperty(firstPerson, 'name', {
    get: function () {
        return name;
    }
});

return members.first.getPerson().name;

EOS
*/;}), // jshint ignore:line
            expectedResult: 'Dan'
        },
        'lookup of accessor property in object literal property initializer': {
            code: nowdoc(function () {/*<<<EOS
var object = {},
    otherObject;

Object.defineProperty(object, 'thing', {
    get: function () {
        return 'A thing';
    }
});

otherObject = {
    value: object.thing
};

return otherObject.value;

EOS
*/;}), // jshint ignore:line
            expectedResult: 'A thing'
        },
        'lookup of accessor property on String.prototype from primitive string value': {
            code: nowdoc(function () {/*<<<EOS
Object.defineProperty(String.prototype, 'doubleLength', {
    get: function () {
        return this.length * 2;
    }
});

return 'abc'.doubleLength;

EOS
*/;}), // jshint ignore:line
            expectedResult: 6
        },
        'lookup of two accessor properties defined with Object.defineProperties(...)': {
            code: nowdoc(function () {/*<<<EOS
var me = {};

Object.defineProperties(me, {
    name: {
        get: function () {
            return 'Dan';
        }
    },
    occupation: {
        get: function () {
            return 'Engineer';
        }
    }
});

return me.name + ', ' + me.occupation;

EOS
*/;}), // jshint ignore:line
            expectedResult: 'Dan, Engineer'
        },
        'lookup of accessor property on right-side of assignment to variable': {
            // ...
        }
    }, tools.check);
});
