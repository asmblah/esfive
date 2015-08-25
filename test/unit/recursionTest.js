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

describe('ESFive recursion/stack limit tests', function () {
    _.each({
        // http://www.cappuccino-project.org/blog/2010/03/internet-explorer-global-variables-and-stack-overflows.html
        'recursing via a property of the global object should not raise a "Stack overflow" error': {
            allowedGlobals: [],
            code: nowdoc(function () {/*<<<EOS
window.recurse = function(times)
{
    if (times !== 0)
        recurse(times - 1);
}

recurse(14);

return true;
EOS
*/;}), // jshint ignore:line
            expectedResult: true
        }
    }, tools.check);
});
