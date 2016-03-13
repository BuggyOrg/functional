
import {backtrackPortGraph} from '@buggyorg/graphtools/lib/backtrack'
import _ from 'lodash'

export function inner (node) {
  if (node.meta !== 'lambda') {
    throw new Error('Lambda.inner: Cannot process non lambda node' + JSON.stringify(node))
  } else {
    return node.data
  }
}

export function functionType (node) {
  var fn = inner(node)
  return {from: fn.inputPorts || [], to: fn.outputPorts || []}
}

export function applyBacktrack (graph, node) {
  return backtrackPortGraph(graph, node, (id, node, payload) => {
    if (_.invertBy(node.inputPorts)['lambda'] === undefined) {
      return {payload: _.concat(payload || [], [id])}
    }
    return _.invertBy(node.inputPorts)['lambda'].map((port) =>
      ({port: port, payload: _.concat(payload || [], [id])}))
  })
}
