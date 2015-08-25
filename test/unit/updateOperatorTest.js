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

describe('ESFive update operator tests', function () {
    _.each({
        'using addition-update prefix operator with object data property': {
            code: nowdoc(function () {/*<<<EOS
var object = {
    val: 6
};

var result = ++object.val;

return [result, object.val];
EOS
*/;}), // jshint ignore:line
            expectedResultDeep: true,
            expectedResult: [7, 7]
        },
        'using addition-update postfix operator with object data property': {
            code: nowdoc(function () {/*<<<EOS
var object = {
    val: 9
};

var result = object.val++;

return [result, object.val];
EOS
*/;}), // jshint ignore:line
            expectedResultDeep: true,
            expectedResult: [9, 10]
        }
    }, tools.check);
});
