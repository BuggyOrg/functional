'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.inner = inner;
exports.functionType = functionType;
exports.applyBacktrack = applyBacktrack;

var _backtrack = require('@buggyorg/graphtools/lib/backtrack');

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function inner(node) {
  if (node.meta !== 'lambda') {
    throw new Error('Lambda.inner: Cannot process non lambda node' + JSON.stringify(node));
  } else {
    return node.data;
  }
}

function functionType(node) {
  var fn = inner(node);
  return { from: fn.inputPorts || [], to: fn.outputPorts || [] };
}

function applyBacktrack(graph, node) {
  return (0, _backtrack.backtrackPortGraph)(graph, node, function (id, node, payload) {
    console.log('backtrack', id);
    if (_lodash2.default.invertBy(node.inputPorts)['lambda'] === undefined) {
      console.log('none...');
      return [];
    }
    return _lodash2.default.invertBy(node.inputPorts)['lambda'].map(function (port) {
      return { port: port, payload: _lodash2.default.concat(payload || [], [id]) };
    });
  });
}