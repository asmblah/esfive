/*
 * ESFive - ES5-to-ES3 transpiler
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/esfive
 *
 * Released under the MIT license
 * https://github.com/asmblah/esfive/raw/master/MIT-LICENSE.txt
 */

'use strict';

module.exports = {
    getFunctionName: function (fn) {
        return fn.name || Function.prototype.toString.call(fn).match(/function\s*([^(]*)\s*\(/)[1];
    },

    isES5: Object.defineProperty && (function () {
        try {
            return Object.defineProperty({}, 'prop', {
                    get: function () {
                        return 7;
                    }
                }).prop === 7;
        } catch (e) {
            return false;
        }
    }()),

    Hash: (function () {
        function Hash() {}
        Hash.prototype = Object.create(null);

        return Hash;
    }()),

    WeakMap: global.WeakMap || require('weak-map')
};
