
import {walk, rewrite} from '@buggyorg/graphtools'
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

export function backtrackLambda (graph, node) {
  return walk.walkBack(graph, node, (graph, node) => {
    return _.invert(graph.node(node).inputPorts || {lambda: []})['lambda']
  })
}

export function backtrackApply (graph, node) {
  var applyPaths = backtrackLambda(graph, node)
  console.log(applyPaths)
  return []
}

export function rewriteApply (graph, node) {
  var paths = backtrackLambda(graph, node)
  var innerNode = inner(graph.node(paths[0][0]))
  var connectors = rewrite.edgeConnectors({
    value: {node: innerNode.name, port: Object.keys(innerNode.value.inputPorts)[0]},
    result: {node: innerNode.name, port: Object.keys(innerNode.value.outputPorts)[0]}
  })
  return rewrite.apply(graph, node, {
    nodes: [innerNode],
    edges: connectors
  })
}
