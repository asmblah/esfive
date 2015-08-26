/*
 * ESFive - ES5-to-ES3 transpiler
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/esfive
 *
 * Released under the MIT license
 * https://github.com/asmblah/esfive/raw/master/MIT-LICENSE.txt
 */

/*jshint latedef:nofunc */
'use strict';

var _ = require('lodash'),
    createError = require('./create/Error'),
    environment = require('./environment'),
    escodegen = require('escodegen'),
    esprima = require('esprima'),
    estraverse = require('estraverse'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    Hash = environment.Hash,
    WeakMap = environment.WeakMap,
    ALLOWED_GLOBALS = 'allowedGlobals',
    ARGUMENTS = 'arguments',
    HAS_OWN_PROPERTY = 'hasOwnProperty',
    NODE_DATA_MAP_CACHE_KEY = 'esFive-nodeDataMap-cache',
    PROTO = '__proto__',
    SOURCE_URI = 'sourceUri',
    callStack = [],
    create = Object.create || function (from) {
            function F() {}
            F.prototype = from;
            return new F();
        },
    // Some special properties may already be defined, eg. '__proto__', so use native Object.defineProperty(...)
    defineProperty = environment.isES5 ? function defineProperty(object, name, descriptor) {
        return Object.defineProperty(object, name, {
            configurable: true,
            enumerable: descriptor.enumerable, // Required for interop with non-transpiled native ES5 code
            writable: true,
            value: createPropertyPointer(object, descriptor)
        });
    } : function defineProperty(object, name, descriptor) {
        object[name] = createPropertyPointer(object, descriptor);

        return object;
    },
    getType = function (obj) {
        return {}.toString.call(obj).match(/\[object ([\s\S]*)\]/)[1];
    },
    hasOwn = {}.hasOwnProperty,
    privatesMap = new WeakMap(),
    secret = {},
    undef;

function ESFive(storage, options) {
    EventEmitter.call(this);

    options = options || {};

    this.nodeDataMap = (function getNodeDataMap() {
        var nodeDataMap;

        if (!storage) {
            return [];
        }

        if ((nodeDataMap = storage.getItem(NODE_DATA_MAP_CACHE_KEY))) {
            nodeDataMap = JSON.parse(nodeDataMap);
        } else {
            nodeDataMap = [];
        }

        return nodeDataMap;
    }());
    this.required = (!environment.isES5 || options.useNative === false);
    this.storage = storage;
}

util.inherits(ESFive, EventEmitter);

_.extend(ESFive.prototype, {
    applyToScope: function (scopeGlobal, options) {
        function makeRedirectedName(name) {
            return '__redirected_' + name + '__';
        }

        var descriptor,
            esFive = this,
            ScopeArray = scopeGlobal.Array,
            ScopeError,
            ScopeObject = scopeGlobal.Object,
            ScopeReferenceError,
            nonDefined = {nonDefined: true},
            getProperty = createPropertyGetter(undef),
            nodeDataMap = esFive.nodeDataMap,
            nonDefinedAwareGetProperty = createPropertyGetter(nonDefined),
            redirectedProperties = (function () {
                /*jshint forin:false */
                var name,
                    names = new Hash();

                for (name in scopeGlobal) {
                    names[name] = makeRedirectedName(name);
                }

                return names;
            }()),
            tools = {
                callStack: callStack,
                defineProperties: defineProperties,
                defineProperty: defineProperty,
                getProperty: getProperty,
                nodeDataMap: nodeDataMap
            };

        options = options || {};

        if (options[ALLOWED_GLOBALS]) {
            _.each(options[ALLOWED_GLOBALS], function (name) {
                delete redirectedProperties[name];
            });
        }

        ScopeError = createError(esFive, tools);
        ScopeReferenceError = function ReferenceError(message) {
            ScopeError.call(this, message);
        };

        util.inherits(ScopeReferenceError, ScopeError);

        scopeGlobal.Error = ScopeError;

        // Potential speed improvement due to WeakMap shim's overloading of .toString() -
        // for large functions, the native code generation could easily be very slow
        scopeGlobal.Function.prototype.toString = function () {
            return '[object Function]';
        };

        ScopeObject.create = createWithProto;
        ScopeObject.defineProperty = function (object, name, descriptor) {
            name = redirectName(object, name);

            return defineProperty(object, name, descriptor);
        };
        ScopeObject.defineProperties = function (object, descriptors) {
            _.forOwn(descriptors, function (descriptor, name) {
                name = redirectName(object, name);

                defineProperty(object, name, descriptor);
            });

            return object;
        };

        ScopeObject.getPrototypeOf = getPrototypeOf;

        ScopeObject.keys = function (object) {
            var key,
                keys = new ScopeArray();

            for (key in object) {
                if (hasOwn.call(object, key)) {
                    keys.push(key);
                }
            }

            return keys;
        };

        function redirectName(object, name) {
            if (name === PROTO) {
                name = makeRedirectedName(name);
            }

            if (object === scopeGlobal && redirectedProperties[name]) {
                return redirectedProperties[name];
            }

            return name;
        }

        function getVariable(name) {
            return getProperty(scopeGlobal, redirectName(scopeGlobal, name));
        }

        function setVariable(name, value) {
            return setProperty(scopeGlobal, redirectName(scopeGlobal, name), value);
        }

        function getMethod(object, propertyName) {
            var method,
                propertyPointer = getProperty(object, redirectName(object, propertyName));

            if (!propertyPointer || propertyPointer.secret !== secret) {
                method = propertyPointer;
            } else {
                method = getValue(object, propertyPointer.descriptor);
            }

            return function () {
                return method.apply(object, arguments);
            };
        }

        function hasProperty(object, propertyName, originalContextObject) {
            var boxedObject,
                privates = getPrivates(object);

            propertyName = redirectName(object, propertyName);

            if (object === null || object === undef) {
                if (originalContextObject !== undef) {
                    return false;
                }

                throw new Error('Cannot search for "' + propertyName + '" in ' + object);
            }

            if (privates && !hasOwn.call(object, propertyName) && privates.prototypeOverride !== undef) {
                return hasProperty(privates.prototypeOverride, propertyName, object);
            }

            // Ensure any primitives are autoboxed using the correct native type classes, eg. Number/Boolean
            /*jshint newcap:false */
            boxedObject = ScopeObject(object);

            if (!(propertyName in boxedObject)) {
                return false;
            }

            return true;
        }

        // Allows differentiation between defined properties with value 'undefined'
        // and properties that are not defined on the object, where necessary.
        function createPropertyGetter(nonDefinedValue) {
            return function getProperty(object, propertyName, originalContextObject) {
                var boxedObject,
                    privates = getPrivates(object),
                    propertyPointer;

                propertyName = redirectName(object, propertyName);

                if (object === null || object === undef) {
                    if (originalContextObject !== undef) {
                        return nonDefinedValue;
                    }

                    throw new Error('Cannot read property "' + propertyName + '" of ' + object);
                }

                if (privates && !hasOwn.call(object, propertyName) && privates.prototypeOverride !== undef) {
                    return getProperty(privates.prototypeOverride, propertyName, object);
                }

                // Ensure any primitives are autoboxed using the correct native type classes, eg. Number/Boolean
                /*jshint newcap:false */
                boxedObject = ScopeObject(object);

                if (!(propertyName in boxedObject)) {
                    return nonDefinedValue;
                }

                propertyPointer = boxedObject[propertyName];

                // Can only be 'undefined' if the last property in chain is not defined,
                // in which case return undefined to throw error
                if (!propertyPointer || propertyPointer.secret !== secret) {
                    return propertyPointer;
                }

                // A null descriptor is used as a special internal indicator of an undefined property
                // (Only applicable to JScript, where properties of the global object cannot be deleted)
                if (!propertyPointer.descriptor) {
                    return nonDefinedValue;
                }

                return getValue(originalContextObject || object, propertyPointer.descriptor);
            };
        }

        function setProperty(object, propertyName, value) {
            var propertyPointer;

            if (object === scopeGlobal && !(propertyName in object)) {
                if (scopeGlobal.eval.call(scopeGlobal, 'typeof ' + propertyName) === 'undefined') {
                    scopeGlobal.eval.call(scopeGlobal, 'var ' + propertyName + ';');
                }
            }

            propertyName = redirectName(object, propertyName);
            propertyPointer = object[propertyName];

            if (!propertyPointer || propertyPointer.secret !== secret || !propertyPointer.descriptor) {
                return (object[propertyName] = value);
            }

            setValue(object, propertyPointer.descriptor, value);

            return value;
        }

        function getEnumerableProperties(object, keys) {
            var name,
                privates = getPrivates(object);

            if (!keys) {
                keys = new Hash();
            }

            if (privates && privates.prototypeOverride) {
                // [[Prototype]] is overridden: add own properties then walk up the chain,
                // as we of course cannot trust non-own properties returned by for..in
                for (name in object) {
                    if (
                        hasOwn.call(object, name) && name !== 'toString' && (
                            !object[name] ||
                            object[name].secret !== secret ||
                            object[name].descriptor.enumerable
                        )
                    ) {
                        keys[name] = true;
                    }
                }

                getEnumerableProperties(privates.prototypeOverride, keys);
            } else {
                for (name in object) {
                    if (
                        name !== 'toString' && (
                            !object[name] ||
                            object[name].secret !== secret ||
                            object[name].descriptor.enumerable
                        )
                    ) {
                        keys[name] = true;
                    }
                }
            }

            return keys;
        }

        function makeScopeVariableGetter(object, previousScope) {
            var depth = previousScope ? previousScope.depth + 1 : 0,
                objects = previousScope ? previousScope.objects.concat([object]) : [object],
                scope = function (name, scopeDepthWithVariable, maybeValue) {
                    var currentDepth,
                        result = nonDefinedAwareGetProperty(object, name);

                    // Current scope object has a property defined with our name: great, just return it.
                    if (result !== nonDefined) {
                        return result;
                    }

                    // Walk up the scope chain looking for an object having a property defined with our name;
                    // but only as far as the scope (if any) in which a variable is defined with the name
                    for (currentDepth = depth; currentDepth >= scopeDepthWithVariable; --currentDepth) {
                        result = nonDefinedAwareGetProperty(objects[currentDepth], name);

                        if (result !== nonDefined) {
                            return result;
                        }
                    }

                    // A variable exists with our name - great, scope lookup stops here.
                    if (scopeDepthWithVariable > -1) {
                        return maybeValue;
                    }

                    // None of the scope objects defined a property with our name,
                    // nor were any variables defined with the name, so look it up on the global object.
                    return getProperty(scopeGlobal, name);
                };

            scope.depth = depth;
            scope.objects = objects;

            return scope;
        }

        function makeScopeVariableSetter(object, parentScopeSetter, previousScope) {
            var depth = previousScope ? previousScope.depth + 1 : 0,
                objects = previousScope ? previousScope.objects.concat([object]) : [object],
                scope = function (name, value, scopeDepthWithVariable) {
                    var currentDepth;

                    // Current scope object has a property defined with our name: great, just assign to it.
                    if (hasProperty(object, name)) {
                        setProperty(object, name, value);
                        return;
                    }

                    // Walk up the scope chain looking for an object having a property defined with our name;
                    // but only as far as the scope (if any) in which a variable is defined with the name
                    for (currentDepth = depth; currentDepth > scopeDepthWithVariable; --currentDepth) {
                        if (hasProperty(objects[currentDepth], name)) {
                            setProperty(objects[currentDepth], name, value);
                            return;
                        }
                    }

                    // A variable exists with our name - great, scope lookup stops here.
                    if (scopeDepthWithVariable > -1) {
                        parentScopeSetter(name, value);
                        return;
                    }

                    // None of the scope objects defined a property with our name,
                    // nor were any variables defined with the name, so look it up on the global object.
                    return setProperty(scopeGlobal, name, value);
                };

            scope.depth = depth;
            scope.objects = objects;

            return scope;
        }

        function deleteProperty(object, propertyName) {
            var propertyPointer;

            propertyName = redirectName(object, propertyName);

            if (!object) {
                object = scopeGlobal;
            }

            propertyPointer = object[propertyName];

            // Non-configurable properties cannot be deleted
            if (propertyPointer && propertyPointer.secret === secret) {
                if (!propertyPointer.descriptor) {
                    // Property is already marked as deleted
                    return true;
                }

                if (!propertyPointer.descriptor.configurable) {
                    return false;
                }
            }

            try {
                delete object[propertyName];
            } catch (e) {
                // Cannot delete properties of the global object in JScript:
                // mark the property as deleted with a null descriptor
                if (propertyPointer && propertyPointer.secret === secret) {
                    propertyPointer.descriptor = null;
                } else {
                    propertyPointer = createPropertyPointer(object, null);
                    object[propertyName] = propertyPointer;
                }
            }

            return true;
        }

        function takeNativeError(nativeError) {
            var error = nativeError,
                latestCallIndex = callStack[callStack.length - 1],
                latestNodeData = nodeDataMap[latestCallIndex];

            if (
                getType(nativeError) === 'Error' &&
                latestNodeData.type === 'call'
            ) {
                error = new ScopeReferenceError(latestNodeData.calleeFunc + ' is not defined');
            }

            return error;
        }

        function throwError(error) {
            var onErrorRedirected = makeRedirectedName('onerror'),
                result;

            if (scopeGlobal[onErrorRedirected]) {
                result = scopeGlobal[onErrorRedirected]();
            }

            if (result !== true) {
                esFive.emit('error', error);
            }
        }

        // Strictly speaking, the prototype for the global object should be Window.prototype,
        // but we'll allow larger libraries like DOMProxy to emulate that.
        //esFive.setPrototypeOf(scopeGlobal, ScopeObject.prototype);
        if (scopeGlobal.EventTarget) {
            esFive.setPrototypeOf(scopeGlobal.EventTarget.prototype, ScopeObject.prototype);
        }

        descriptor = {
            configurable: true,
            enumerable: false,
            get: function () {
                var privates = getPrivates(this);

                return privates && privates.prototypeOverride !== undef ?
                    privates.prototypeOverride :
                    ScopeObject.prototype;
            },
            set: function (prototype) {
                var privates = getOrCreatePrivates(this);

                privates.prototypeOverride = prototype;
            }
        };
        ScopeObject.defineProperty(ScopeObject.prototype, PROTO, descriptor);
        ScopeObject.defineProperty(scopeGlobal, PROTO, descriptor);

        ScopeObject.prototype[HAS_OWN_PROPERTY] = function (name) {
            var object = this,
                propertyPointer;

            if (!hasOwn.call(object, name)) {
                return false;
            }

            propertyPointer = object[name];

            if (propertyPointer && propertyPointer.secret === secret && !propertyPointer.descriptor) {
                return false;
            }

            return true;
        };

        if (!ScopeArray.prototype.indexOf) {
            ScopeObject.defineProperty(ScopeArray.prototype, 'indexOf', {
                configurable: true,
                enumerable: false,
                writable: true,
                value: function (value) {
                    var array = this,
                        index,
                        length = array.length;

                    for (index = 0; index < length; index++) {
                        if (array[index] === value) {
                            return index;
                        }
                    }

                    return -1;
                }
            });
        }

        if (!ScopeArray.prototype.forEach) {
            ScopeObject.defineProperty(ScopeArray.prototype, 'forEach', {
                configurable: true,
                enumerable: false,
                writable: true,
                value: function (callback) {
                    var array = this,
                        index,
                        length = array.length;

                    for (index = 0; index < length; index++) {
                        callback.call(array[index], array[index]);
                    }
                }
            });
        }

        if (!ScopeArray.prototype.map) {
            ScopeObject.defineProperty(ScopeArray.prototype, 'map', {
                configurable: true,
                enumerable: false,
                writable: true,
                value: function () {
                    return new ScopeArray();
                }
            });
        }

        if (!ScopeArray.prototype.reduce) {
            ScopeObject.defineProperty(ScopeArray.prototype, 'reduce', {
                configurable: true,
                enumerable: false,
                writable: true,
                value: function () {
                    return 'FIXME';
                }
            });
        }

        // Needed by Chai when generating error message after failed assertion
        if (!ScopeArray.isArray) {
            ScopeArray.isArray = _.isArray;
        }

        scopeGlobal.__callStack__ = callStack;
        scopeGlobal.__deleteProp__ = deleteProperty;
        scopeGlobal.__enumProps__ = getEnumerableProperties;
        scopeGlobal.__getMethod__ = getMethod;
        scopeGlobal.__getProp__ = getProperty;
        scopeGlobal.__getVar__ = getVariable;
        scopeGlobal.__makeGetScopeVar__ = makeScopeVariableGetter;
        scopeGlobal.__makeSetScopeVar__ = makeScopeVariableSetter;
        scopeGlobal.__redirectedProperties__ = redirectedProperties;
        scopeGlobal.__setProp__ = setProperty;
        scopeGlobal.__setVar__ = setVariable;
        scopeGlobal.__takeNativeError__ = takeNativeError;
        scopeGlobal.__throw__ = throwError;
    },

    create: createWithProto,

    defineProperties: defineProperties,

    defineProperty: defineProperty,

    getOwnPropertyNames: getOwnPropertyNames,

    getPrototypeOf: getPrototypeOf,

    isRequired: function () {
        return this.required;
    },

    setScopeGlobal: function (scopeGlobal, name, value) {
        var redirectedProperties = scopeGlobal.__redirectedProperties__;

        if (redirectedProperties[name]) {
            name = redirectedProperties[name];
        }

        scopeGlobal[name] = value;
    },

    setPrototypeOf: function (object, prototype) {
        var privates = getOrCreatePrivates(object);

        privates.prototypeOverride = prototype;
    },

    transpile: function (code, options) {
        var esFive = this,
            cacheKey,
            cacheResult,
            hasSourceUri,
            helperFunctions,
            node,
            nodeDataMap = esFive.nodeDataMap,
            sourceUri;

        options = options || {};
        hasSourceUri = !!options[SOURCE_URI];
        sourceUri = hasSourceUri ? options[SOURCE_URI] : '<anonymous>';
        cacheKey = 'esFive-transpile-cache-' + sourceUri;

        if (!esFive.required) {
            // No transpilation required
            return code;
        }

        if (esFive.storage && hasSourceUri && (cacheResult = esFive.storage.getItem(cacheKey)) !== null) {
            return cacheResult;
        }

        function replaceNode(oldNode, newNode) {
            /*jshint forin:false */
            var name;

            for (name in oldNode) {
                delete oldNode[name];
            }

            for (name in newNode) {
                oldNode[name] = newNode[name];
            }
        }

        node = esprima.parse(code, {
            attachComment: true,
            loc: true
        });

        function transpileNode(node) {
            var Syntax = esprima.Syntax,
                functionNameStack = [],
                enter,
                leave,
                scopeVariableStack = [new Hash()],
                scopeVariables = scopeVariableStack[0],
                withScopeDepth = -1,
                withScopeStack = [];

            function wrapVariableGet(identifierNode) {
                var args,
                    name = identifierNode.name,
                    scopeDepthWithVariable = withScopeDepth;

                while (scopeDepthWithVariable > -1 && !(name in withScopeStack[scopeDepthWithVariable])) {
                    scopeDepthWithVariable--;
                }

                args = [{
                    type: Syntax.Literal,
                    value: name
                }];

                if (withScopeDepth > -1) {
                    args.push(esprima.parse(scopeDepthWithVariable).body[0].expression);
                }

                if (scopeDepthWithVariable > -1) {
                    args.push(_.extend({}, identifierNode));
                }

                return {
                    type: Syntax.CallExpression,
                    callee: {
                        type: Syntax.Identifier,
                        name: withScopeDepth > -1 ? ('__getScopeVar' + withScopeDepth + '__') : '__getVar__'
                    },
                    arguments: args
                };
            }

            function wrapVariableSet(assignmentNode) {
                var args,
                    name = assignmentNode.left.name,
                    scopeDepthWithVariable = withScopeDepth;

                while (scopeDepthWithVariable > -1 && !(name in withScopeStack[scopeDepthWithVariable])) {
                    scopeDepthWithVariable--;
                }

                args = [{
                    type: Syntax.Literal,
                    value: name
                }, assignmentNode.right];

                if (withScopeDepth > -1) {
                    args.push(esprima.parse(scopeDepthWithVariable).body[0].expression);
                }

                return {
                    type: Syntax.CallExpression,
                    callee: {
                        type: Syntax.Identifier,
                        name: withScopeDepth > -1 ? ('__setScopeVar' + withScopeDepth + '__') : '__setVar__'
                    },
                    arguments: args
                };
            }

            function getPropertyName(memberNode) {
                return (!memberNode.computed && memberNode.property.type === Syntax.Identifier) ? {
                    type: Syntax.Literal,
                    value: memberNode.property.name
                } : memberNode.property;
            }

            function makeCallStackPush(index) {
                return {
                    type: Syntax.CallExpression,
                    callee: {
                        type: Syntax.MemberExpression,
                        object: {
                            type: Syntax.Identifier,
                            name: '__callStack__'
                        },
                        computed: false,
                        property: {
                            type: Syntax.Identifier,
                            name: 'push'
                        }
                    },
                    arguments: [{
                        type: Syntax.Literal,
                        value: index
                    }]
                };
            }

            function makeCallStackPop() {
                return {
                    type: Syntax.CallExpression,
                    callee: {
                        type: Syntax.MemberExpression,
                        object: {
                            type: Syntax.Identifier,
                            name: '__callStack__'
                        },
                        computed: false,
                        property: {
                            type: Syntax.Identifier,
                            name: 'pop'
                        }
                    },
                    arguments: []
                };
            }

            function wrapFunctionCall(callNode, callNodeIndex) {
                return {
                    type: Syntax.SequenceExpression,
                    expressions: [
                        makeCallStackPush(callNodeIndex),
                        {
                            type: Syntax.AssignmentExpression,
                            operator: '=',
                            left: {
                                type: Syntax.Identifier,
                                name: '__result__'
                            },
                            right: callNode
                        },
                        makeCallStackPop(),
                        {
                            type: Syntax.Identifier,
                            name: '__result__'
                        }
                    ]
                };
            }

            enter = function (node) {
                var args,
                    declaration,
                    index,
                    newNode,
                    nodeData;

                if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
                    replaceNode(node.callee, {
                        type: 'CallExpression',
                        callee: {
                            type: 'Identifier',
                            name: '__getMethod__'
                        },
                        arguments: [
                            node.callee.object,
                            (!node.callee.computed && node.callee.property.type === 'Identifier') ? {
                                type: 'Literal',
                                value: node.callee.property.name
                            } : node.callee.property
                        ]
                    });
                } else if (node.type === 'MemberExpression') {
                    replaceNode(node, {
                        type: 'CallExpression',
                        callee: {
                            type: 'Identifier',
                            name: '__getProp__'
                        },
                        arguments: [
                            node.object,
                            (!node.computed && node.property.type === 'Identifier') ? {
                                type: 'Literal',
                                value: node.property.name
                            } : node.property
                        ]
                    });
                }

                if (node.type === Syntax.VariableDeclarator) {
                    scopeVariables[node.id.name] = true;

                    if (
                        node.init &&
                        node.init.type === Syntax.Identifier &&
                        !(node.init.name in scopeVariables)
                    ) {
                        node.init = wrapVariableGet(node.init);
                    }
                } else if (
                    node.type === Syntax.FunctionDeclaration ||
                    node.type === Syntax.FunctionExpression
                ) {
                    if (node.id) {
                        scopeVariables[node.id.name] = true;
                        functionNameStack.push(node.id.name);
                    } else {
                        functionNameStack.push(null);
                    }

                    scopeVariables = create(scopeVariables);
                    scopeVariableStack.push(scopeVariables);

                    // 'arguments' variable is special inside functions
                    scopeVariables[ARGUMENTS] = true;

                    _.each(node.params, function (node) {
                        if (node.type === Syntax.Identifier) {
                            scopeVariables[node.name] = true;
                        }
                    });

                    // Pre-hoist all variable and function declarations in the function
                    //(function debugPrehoist() {
                    _.each(node.body.body, function (node) {
                        if (node.type === Syntax.VariableDeclaration) {
                            _.each(node.declarations, function (node) {
                                scopeVariables[node.id.name] = true;
                            });
                        } else if (node.type === Syntax.FunctionDeclaration) {
                            scopeVariables[node.id.name] = true;
                        }
                    });
                    //}());
                } else if (node.type === Syntax.AssignmentExpression) {
                    if (node.right.type === Syntax.Identifier && !(node.right.name in scopeVariables)) {
                        node.right = wrapVariableGet(node.right);
                    }

                    if (node.left.type === Syntax.MemberExpression) {
                        newNode = (node.operator === '=') ? node.right : {
                            type: Syntax.BinaryExpression,
                            operator: node.operator.charAt(0),
                            left: {
                                type: Syntax.CallExpression,
                                callee: {
                                    type: Syntax.Identifier,
                                    name: '__getProp__'
                                },
                                arguments: [
                                    node.left.object,
                                    getPropertyName(node.left)
                                ]
                            },
                            right: node.right
                        };

                        return {
                            type: Syntax.CallExpression,
                            callee: {
                                type: Syntax.Identifier,
                                name: '__setProp__'
                            },
                            arguments: [
                                node.left.object,
                                getPropertyName(node.left),
                                newNode
                            ]
                        };
                    }

                    if (node.left.type === Syntax.Identifier && !(node.left.name in scopeVariables)) {
                        return wrapVariableSet((node.operator === '=') ? node : {
                            type: Syntax.AssignmentExpression,
                            operator: '=',
                            left: node.left,
                            right: {
                                type: Syntax.BinaryExpression,
                                operator: node.operator.charAt(0),
                                left: wrapVariableGet(node.left),
                                right: node.right
                            }
                        });
                    }
                } else if (node.type === Syntax.ReturnStatement) {
                    if (node.argument && node.argument.type === Syntax.Identifier && !(node.argument.name in scopeVariables)) {
                        node.argument = wrapVariableGet(node.argument);
                        this.skip();
                    }
                } else if (node.type === Syntax.BinaryExpression) {
                    if (node.left.type === Syntax.Identifier && !(node.left.name in scopeVariables)) {
                        node.left = wrapVariableGet(node.left);
                    }
                    if (node.right.type === Syntax.Identifier && !(node.right.name in scopeVariables)) {
                        node.right = wrapVariableGet(node.right);
                    }
                } else if (node.type === Syntax.ArrayExpression) {
                    _.each(node.elements, function (node) {
                        if (node.type === Syntax.Identifier && !(node.name in scopeVariables)) {
                            replaceNode(node, wrapVariableGet(node));
                        }
                    });
                } else if (node.type === Syntax.CallExpression) {
                    //(function debugProcessCallArgs() {
                    _.each(node.arguments, function (node) {
                        if (node.type === Syntax.Identifier) {
                            if (!(node.name in scopeVariables)) {
                                replaceNode(node, wrapVariableGet(node));
                            }
                        } else {
                            estraverse.replace(node, {
                                enter: enter,
                                leave: leave
                            });
                        }
                    });
                    //}());

                    // Make sure we process the callee node but skip arguments to prevent recursion
                    this.skip();
                    estraverse.replace(node.callee, {
                        enter: enter,
                        leave: leave
                    });

                    if (node.loc) {
                        nodeData = {
                            contextFunc: functionNameStack[functionNameStack.length - 1],
                            sourceUri: sourceUri,
                            location: node.loc,
                            type: 'call'
                        };
                        nodeDataMap.push(nodeData);

                        if (node.callee.type === Syntax.Identifier) {
                            nodeData.calleeFunc = node.callee.name;
                        }

                        return wrapFunctionCall(node, nodeDataMap.length - 1);
                    }
                } else if (node.type === Syntax.Property) {
                    if (
                        node.kind === 'init' &&
                        node.value.type === Syntax.Identifier &&
                        !(node.value.name in scopeVariables)
                    ) {
                        node.value = wrapVariableGet(node.value);
                    }
                } else if (node.type === Syntax.UnaryExpression) {
                    if (node.operator === 'delete') {
                        if (node.argument.type === Syntax.MemberExpression) {
                            if (node.argument.computed) {
                                args = [node.argument.object, node.argument.property];
                            } else {
                                args = [node.argument.object, {
                                    type: Syntax.Literal,
                                    value: node.argument.property.name
                                }];
                            }
                        } else if (node.argument.type === Syntax.Identifier) {
                            for (index = scopeVariableStack.length - 1; index >= 0; index--) {
                                if (node.argument.name in scopeVariableStack[index]) {
                                    replaceNode(node, {
                                        type: Syntax.Identifier,
                                        name: 'false'
                                    });

                                    return;
                                }
                            }

                            args = [{
                                type: Syntax.Identifier,
                                name: 'null'
                            }, {
                                type: Syntax.Literal,
                                value: node.argument.name
                            }];
                        } else if (node.argument.type === Syntax.Literal) {
                            replaceNode(node, {
                                type: Syntax.Identifier,
                                name: 'true'
                            });

                            return;
                        } else {
                            args = [{
                                type: Syntax.Identifier,
                                name: 'null'
                            }, node.argument];
                        }

                        replaceNode(node, {
                            type: Syntax.CallExpression,
                            callee: {
                                type: Syntax.Identifier,
                                name: '__deleteProp__'
                            },
                            arguments: args
                        });

                        // FIXME: Still need to recursively process object and propertyName
                        this.skip();
                    } else if (node.argument.type === Syntax.Identifier && !(node.argument.name in scopeVariables)) {
                        node.argument = wrapVariableGet(node.argument);
                    }
                } else if (node.type === Syntax.UpdateExpression) {
                    if (node.argument.type === Syntax.MemberExpression) {
                        if (node.operator === '++') {
                            newNode = {
                                type: Syntax.CallExpression,
                                callee: {
                                    type: Syntax.Identifier,
                                    name: '__getProp__'
                                },
                                arguments: [
                                    node.argument.object,
                                    (!node.argument.computed && node.argument.property.type === Syntax.Identifier) ? {
                                        type: 'Literal',
                                        value: node.argument.property.name
                                    } : node.argument.property
                                ]
                            };

                            if (!node.prefix) {
                                newNode = {
                                    type: Syntax.AssignmentExpression,
                                    operator: '=',
                                    left: {
                                        type: Syntax.Identifier,
                                        name: '__postfixOldValue__'
                                    },
                                    right: newNode
                                };
                            }

                            newNode = {
                                type: Syntax.CallExpression,
                                callee: {
                                    type: Syntax.Identifier,
                                    name: '__setProp__'
                                },
                                arguments: [
                                    node.argument.object,
                                    (!node.argument.computed && node.argument.property.type === 'Identifier') ? {
                                        type: 'Literal',
                                        value: node.argument.property.name
                                    } : node.argument.property,
                                    {
                                        type: Syntax.BinaryExpression,
                                        operator: '+',
                                        left: newNode,
                                        right: {
                                            type: Syntax.Literal,
                                            value: 1
                                        }
                                    }
                                ]
                            };

                            if (!node.prefix) {
                                newNode = {
                                    type: Syntax.SequenceExpression,
                                    expressions: [newNode, {
                                        type: Syntax.Identifier,
                                        name: '__postfixOldValue__'
                                    }]
                                };
                            }

                            // Don't wrap the 'old value' assignment, etc.
                            this.skip();

                            return newNode;
                        }
                    }
                } else if (node.type === Syntax.ForInStatement) {
                    node.right = {
                        type: Syntax.CallExpression,
                        callee: {
                            type: Syntax.Identifier,
                            name: '__enumProps__'
                        },
                        arguments: [node.right]
                    };
                } else if (node.type === Syntax.NewExpression) {
                    nodeDataMap.push({
                        contextFunc: functionNameStack[functionNameStack.length - 1],
                        sourceUri: sourceUri,
                        location: node.loc,
                        type: 'new'
                    });

                    replaceNode(node, wrapFunctionCall(_.extend({}, node), nodeDataMap.length - 1));

                    // FIXME: Still need to recursively process callee and arguments
                    this.skip();
                } else if (node.type === Syntax.CatchClause) {
                    if (node.param.type === Syntax.Identifier) {
                        scopeVariables[node.param.name] = true;
                    }

                    node.body.body.unshift({
                        type: Syntax.ExpressionStatement,
                        expression: {
                            type: Syntax.AssignmentExpression,
                            operator: '=',
                            left: node.param,
                            right: {
                                type: Syntax.CallExpression,
                                callee: {
                                    type: Syntax.Identifier,
                                    name: '__takeNativeError__'
                                },
                                arguments: [node.param]
                            }
                        }
                    });
                    /*} else if (node.type === Syntax.ThrowStatement) {
                     return {
                     type: Syntax.ExpressionStatement,
                     expression: {
                     type: Syntax.CallExpression,
                     callee: {
                     type: Syntax.Identifier,
                     name: '__throw__'
                     },
                     arguments: [node.argument]
                     }
                     };*/
                    // Variables must be late-bound inside 'with {...}', as it is unknown until encountered
                    // which properties will be defined on the object. Also, inside the 'with {...}',
                    // the scope object may be modified in any way, which must be taken into account.
                } else if (node.type === Syntax.WithStatement) {
                    // Need to allow local variables defined in a parent scope to be referenced
                    // if not present as a property of a scope object

                    // Need to remove the actual with {...} as it could interfere
                    // (eg. if the scope object's native prototype chain contains the variable name as a property,
                    // but the prototype has been redirected so it should not be used)

                    withScopeStack.push(scopeVariables);
                    withScopeDepth++;
                    scopeVariables = new Hash();
                    scopeVariableStack.push(scopeVariables);

                    args = [
                        node.object,
                        esprima.parse(
                            '(function (__name__, __value__) { eval(__name__ + \'=__value__;\'); })'
                        ).body[0].expression
                    ];

                    if (withScopeDepth > 0) {
                        args.push({
                            type: Syntax.Identifier,
                            name: '__setScopeVar' + (withScopeDepth - 1) + '__'
                        });
                    }

                    declaration = {
                        type: Syntax.VariableDeclaration,
                        kind: 'var',
                        declarations: [{
                            type: Syntax.VariableDeclarator,
                            id: {
                                type: Syntax.Identifier,
                                name: '__getScopeVar' + withScopeDepth + '__'
                            },
                            init: {
                                type: Syntax.CallExpression,
                                callee: {
                                    type: Syntax.Identifier,
                                    name: '__makeGetScopeVar__'
                                },
                                arguments: withScopeDepth > 0 ? [node.object, {
                                    type: Syntax.Identifier,
                                    name: '__getScopeVar' + (withScopeDepth - 1) + '__'
                                }] : [node.object]
                            }
                        }, {
                            type: Syntax.VariableDeclarator,
                            id: {
                                type: Syntax.Identifier,
                                name: '__setScopeVar' + withScopeDepth + '__'
                            },
                            init: {
                                type: Syntax.CallExpression,
                                callee: {
                                    type: Syntax.Identifier,
                                    name: '__makeSetScopeVar__'
                                },
                                arguments: args
                            }
                        }]
                    };

                    replaceNode(node, node.body);

                    estraverse.replace(node, {
                        enter: enter,
                        leave: leave
                    });
                    node.body.unshift(declaration);

                    scopeVariableStack.pop();
                    scopeVariables = scopeVariableStack[scopeVariableStack.length - 1];
                    withScopeStack.pop();
                    withScopeDepth--;

                    this.skip();
                }
            };

            leave = function (node) {
                if (node.type === Syntax.FunctionDeclaration) {
                    scopeVariableStack.pop();
                    scopeVariables = scopeVariableStack[scopeVariableStack.length - 1];

                    functionNameStack.pop();
                }

                if (
                    node.type === Syntax.FunctionDeclaration ||
                    node.type === Syntax.FunctionExpression
                ) {
                    functionNameStack.pop();
                }
            };

            estraverse.replace(node, {
                enter: enter,
                leave: leave
            });
        }

        transpileNode(node);

        helperFunctions = [
            '__deleteProp__',
            '__enumProps__',
            '__getMethod__',
            '__getProp__',
            '__getVar__',
            '__makeGetScopeVar__',
            '__makeSetScopeVar__',
            '__setProp__',
            '__setVar__',
            '__takeNativeError__',
            '__throw__'
        ].join(',');

        if (node.body[0].type === esprima.Syntax.ExpressionStatement) {
            node.body[0].expression = {
                type: esprima.Syntax.SequenceExpression,
                expressions: [esprima.parse(
                    '(__callStack__.length = 0)'
                ).body[0].expression, node.body[0].expression]
            };

            code = escodegen.generate(node, {comment: true});

            code = '(function (' + helperFunctions + ') { try { return (' + code.replace(/;$/, '') + '); } catch (error) { __throw__(__takeNativeError__(error)); } }(' + helperFunctions + '))';
        } else {
            code = '(function (' + helperFunctions + ') { ' + escodegen.generate(node, {comment: true}) + ' }(' + helperFunctions + '));';
        }

        //alert('Transpile of ' + sourceUri + ' took ' + (+new Date() - start) + 'ms');

        if (esFive.storage) {
            if (hasSourceUri) {
                esFive.storage.setItem(cacheKey, code);
            }

            esFive.storage.setItem(NODE_DATA_MAP_CACHE_KEY, JSON.stringify(nodeDataMap));
        }

        return code;
    }
});

function createWithProto(from) {
    var object,
        privates;

    function F() {}
    F.prototype = from;
    object = new F();

    privates = {
        prototypeOverride: from
    };

    privatesMap.set(object, privates);

    return object;
}

function createPropertyPointer(object, descriptor) {
    var propertyPointer = function () {
        return getValue(this, descriptor).apply(this, arguments);
    };

    propertyPointer.descriptor = descriptor;
    propertyPointer.secret = secret;

    return propertyPointer;
}

function defineProperties(object, descriptors) {
    var name;

    for (name in descriptors) {
        if (hasOwn.call(descriptors, name)) {
            defineProperty(object, name, descriptors[name]);
        }
    }
}

function getOwnPropertyNames(object) {
    var name,
        names = [];

    for (name in object) {
        if (hasOwn.call(object, name)) {
            names.push(name);
        }
    }

    return names;
}

function getPrivates(object) {
    /*jshint newcap:false */
    if (typeof object !== 'object' || !object) {
        return null;
    }

    try {
        return privatesMap.get(object);
    } catch (error) {}

    return null;
}

function getPrototypeOf(object) {
    var privates = getPrivates(object);

    if (privates && privates.prototypeOverride !== undef) {
        return privates.prototypeOverride;
    }

    return object.constructor.prototype;
}

function getOrCreatePrivates(object) {
    var privates;

    if (typeof object !== 'object') {
        return {};
    }

    if (privatesMap.has(object)) {
        return privatesMap.get(object);
    }

    privates = {};
    privatesMap.set(object, privates);

    return privates;
}

function getValue(object, descriptor) {
    if (descriptor.hasOwnProperty('value')) {
        return descriptor.value;
    }

    return descriptor.get.call(object);
}

function setValue(object, descriptor, value) {
    if (descriptor.hasOwnProperty('value')) {
        if (descriptor.writable) {
            descriptor.value = value;
        }
        return;
    }

    descriptor.set.call(object, value);
}

module.exports = ESFive;
