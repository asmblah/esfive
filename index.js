/*
 * ESFive - ES5-to-ES3 transpiler
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/esfive
 *
 * Released under the MIT license
 * https://github.com/asmblah/esfive/raw/master/MIT-LICENSE.txt
 */

'use strict';

var ESFive = require('./src/ESFive');

module.exports = {
    create: function (storage, options) {
        return new ESFive(storage, options);
    }
};
