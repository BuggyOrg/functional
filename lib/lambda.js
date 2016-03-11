'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.inner = inner;
exports.functionType = functionType;
exports.applyBacktrack = applyBacktrack;

var _backtrack = require('@buggyorg/graphtools/lib/backtrack');

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
  (0, _backtrack.backtrackPortGraph)(graph, node, function (node, payload) {
    return [];
  });
}