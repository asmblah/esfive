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
    environment = require('../environment'),
    util = require('util'),
    privatesMap = new environment.WeakMap(),
    NativeError = Error;

module.exports = function (esFive, tools) {
    var callStack = tools.callStack,
        nodeDataMap = tools.nodeDataMap;

    function Error(message) {
        initError(this, message);
    }

    util.inherits(Error, NativeError);

    tools.defineProperties(Error.prototype, {
        'message': {
            'configurable': true,
            'enumerable': false,
            'writable': true,
            'value': ''
        },
        'toString': {
            'configurable': true,
            'enumerable': false,
            'writable': true,
            'value': function () {
                var error = this;
                initError(error, tools.getProperty(error, 'message'));
                return privatesMap.get(error).prefixedMessage;
            }
        }
    });

    function initError(error, message) {
        var prefixedMessage = environment.getFunctionName(error.constructor);

        if (message) {
            prefixedMessage += ': ' + message;
        }

        privatesMap.set(error, {
            constructor: error.constructor,
            message: message,
            prefixedMessage: prefixedMessage
        });

        tools.defineProperties(error, {
            'message': {
                'configurable': true,
                'enumerable': false,
                'writable': true,
                'value': message
            },
            'stack': {
                'configurable': true,
                'enumerable': false,
                'writable': true,
                // Build the call stack immediately as it needs to reflect the call stack
                // where the error object was created. Errors should be created rarely.
                'value': buildCallStack(prefixedMessage)
            }
        });
    }

    function buildCallStack(message) {
        var locations = [];

        _.each(callStack, function (callNodeIndex) {
            var callNode = nodeDataMap[callNodeIndex],
                column,
                line,
                location;

            if (callNode.type === 'call' && callNode.location.end.line !== callNode.location.start.line) {
                column = callNode.location.end.column - 1;
                line = callNode.location.end.line;
            } else {
                column = callNode.location.start.column + 1;
                line = callNode.location.start.line;
            }

            location = callNode.sourceUri + ':' + line + ':' + column;

            if (callNode.contextFunc) {
                location = callNode.contextFunc + ' (' + location + ')';
            }

            locations.unshift(location);
        });

        return [message].concat(locations).join('\n    at ');
    }

    return Error;
};
