
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

export function partialize (graph, lambdaNode, path) {
  // expect that every node on the path is a partial node
  if (_.filter(path, (p) => graph.node(p).meta !== 'partial').length !== 0) {
    throw new Error(`Cannot process a partial application path with non partials.
      Found non partials: ${_.filter(path, (p) => graph.node(p).meta !== 'partial')}`)
  }
  return _.reduce(path, (ports, p) => {
    var partial = graph.node(p)
    var port = partial.port
    return _.assign({}, ports,
      {
        input: _.reject(ports.input, (pname) => pname === port),
        portmap: _.concat(ports.portmap, [{port: port, partial: p}])
      })
  },
    {
      input: Object.keys(lambdaNode.value.inputPorts),
      output: Object.keys(lambdaNode.value.outputPorts),
      portmap: []
    })
}

export function rewriteApply (graph, node) {
  var paths = backtrackLambda(graph, node)
  var innerNode = inner(graph.node(paths[0][0]))
  var remainingPorts = partialize(graph, innerNode, paths[0].slice(1, -1))
  if (remainingPorts.input.length !== 1) {
    throw new Error(`Cannot apply value on function with ${remainingPorts.input.length} inputs.
      Apply only works with exactly one input, use partial.

      Apply Node: ${node}
      Lambda Path: ${paths[0]}
      Remaining Input Ports: ${remainingPorts.input}`)
  }
  var connectors = rewrite.edgeConnectors(graph, node, {
    value: {node: innerNode.v, port: remainingPorts.input[0]},
    result: {node: innerNode.v, port: remainingPorts.output[0]}
  })
  return rewrite.apply(graph, node, {
    nodes: [innerNode],
    edges: connectors
  })
}
