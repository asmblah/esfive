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
    tools = require('../tools');

describe('ESFive assignment operator tests', function () {
    _.each({
        'nested assignment to object data property inside another': {
            code: nowdoc(function () {/*<<<EOS
var object = {
    val: 15
};

object.val4 = (object.val2 = 20) + (object.val3 = 21) + 2;

return object;
EOS
*/;}), // jshint ignore:line
            expectedResultDeep: true,
            expectedResult: {
                val: 15,
                val2: 20,
                val3: 21,
                val4: 43
            }
        }
    }, tools.check);
});
