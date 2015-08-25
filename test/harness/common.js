/*
 * ESFive - ES5-to-ES3 transpiler
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/esfive
 *
 * Released under the MIT license
 * https://github.com/asmblah/esfive/raw/master/MIT-LICENSE.txt
 */

/*global sinon:true */
'use strict';

var chai = require('chai'),
    sinon = require('sinon'),
    sinonChai = require('sinon-chai');

// Load Sinon-Chai
chai.use(sinonChai);

// Expose tools in the global scope
global.chai = chai;
global.expect = chai.expect;
global.sinon = sinon;
