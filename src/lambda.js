
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
  backtrackPortGraph(graph, node, (node, payload) => {
    return []
  })
}
