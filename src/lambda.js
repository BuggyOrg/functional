
import {walk, rewrite, utils} from '@buggyorg/graphtools'
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
    if (graph.node(node).id === 'functional/lambda') {
      return []
    }
    var functions = _.invert(graph.node(node).inputPorts || {function: []})['function']
    var generics = _.invert(graph.node(node).inputPorts || {generic: []})['generic']
    var ports = _.compact(_.map(_.flatten(_.concat(functions, generics)), (v) => '' + v))
    if (ports.length === 0) {
      return null
    }
    return ports
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

var applyNodes = (graph) => {
  return _.filter(graph.nodes(), (n) => graph.node(n).id === 'functional/apply')
}

var findFunctionType = (graph, meta) => {
  var node = _(graph.nodes())
    .map((n) => ({v: n, value: graph.node(n)}))
    .find((n) => n.value.id === meta)

  var rKeys = _.keys(node.value.outputPorts)
  return {
    arguments: node.value.inputPorts,
    return: (rKeys.length === 1) ? node.value.outputPorts[rKeys[0]] : node.value.outputPorts
  }
}

export function portmapToEdges (graph, innerNode, portmap) {
  return _.flatten(_.map(portmap, (pm) => {
    var pred = walk.predecessor(graph, pm.partial, 'value')
    var edge = graph.edge({v: pred, w: pm.partial})
    return _.map(pred, (p) => ({v: p, w: innerNode.v, value: {inPort: pm.port, outPort: edge.outPort}}))
  }))
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
    edges: _.concat(connectors, portmapToEdges(graph, innerNode, remainingPorts.portmap))
  })
}

var updatePorts = (node, ports, applys) => {
  return _.mapValues(ports, (p) => {
    if (p === 'function' || p === 'generic') {
      return applys[node].type
    } else if (p === 'function:return') {
      return applys[node].type.return
    } else if (p === 'function:arg') {
      console.error(JSON.stringify(applys[node]))
      return applys[node].type.arguments[_.keys(applys[node].type.arguments)[0]]
    }
  })
}

export function resolveLambdaTypes (graph) {
  var anodes = applyNodes(graph)
  var types = _(anodes)
    .map(_.partial(backtrackLambda, graph))
    .zip(anodes)
    .map((arr) => ({apply: arr[1], lambda: arr[0][0][0], path: arr[0][0]}))
    .map((res) => _.merge({}, res, {implementation: graph.node(res.lambda).params.implementation}))
    .map((res) => _.merge({}, res, {type: findFunctionType(graph, res.implementation)}))
    .value()
  var args = _.concat([{}], _.map(types, (t) => _.fromPairs(_.map(t.path, (p) => [p, t]))))
  var applys = _.merge.apply(null, args)
  var editGraph = utils.edit(graph)
  editGraph = _.merge({}, editGraph, {
    nodes: _.map(editGraph.nodes, (n) => {
      if (!_.has(applys, n.v)) {
        return n
      } else {
        return _.merge({}, n, {value:
        {
          inputPorts: updatePorts(n.v, n.value.inputPorts, applys),
          outputPorts: updatePorts(n.v, n.value.outputPorts, applys)
        }})
      }
    })
  })
  return utils.finalize(editGraph)
}
