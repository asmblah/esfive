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

describe('ESFive global object prototype', function () {
    describe('after redirection with magic __proto__ property, referencing via "window"', function () {
        _.each({
            'own properties of new prototype object should be accessible as global variables': {
                code: nowdoc(function () {/*<<<EOS
window.__proto__ = {
    me: 'Dan'
};

return me;
EOS
*/;}), // jshint ignore:line
                expectedResult: 'Dan'
            }
        }, tools.check);
    });
});
