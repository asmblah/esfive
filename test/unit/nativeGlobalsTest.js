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

describe('ESFive native globals support', function () {
    _.each({
        'defining a property of global object called "document" via assignment': {
            allowedGlobals: [],
            code: nowdoc(function () {/*<<<EOS
document = 4;
return document;
EOS
*/;}), // jshint ignore:line
            expectedResult: 4
        },
        'defining a property of global object called "window" via assignment': {
            allowedGlobals: [],
            code: nowdoc(function () {/*<<<EOS
window = 6;
return window;
EOS
*/;}), // jshint ignore:line
            expectedResult: 6
        },
        'accessing the native setTimeout function as a property of the global object via "this"': {
            allowedGlobals: ['setTimeout'],
            code: nowdoc(function () {/*<<<EOS
return !!this.setTimeout;
EOS
*/;}), // jshint ignore:line
            expectedResult: true
        },
        'defining a global property by adding to part of the global object\'s prototype chain': {
            allowedGlobals: ['Window'],
            code: nowdoc(function () {/*<<<EOS
Object.getPrototypeOf(this).myGlobal = 27;

return this.myGlobal;
EOS
*/;}), // jshint ignore:line
            expectedResult: 27
        }
    }, tools.check);
});
