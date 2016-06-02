
import {walk, rewrite, utils} from '@buggyorg/graphtools'
import _ from 'lodash'

export function inner (node) {
  if (node.id !== 'functional/lambda') {
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
  return walk.walkBack(graph, node, (graph, node, port) => {
    var lambdaPort = graph.parent(node) && graph.node(graph.parent(node)).isLambda
    if (graph.node(node).id === 'functional/lambda') {
      return []
    }
    var functions = (_.invertBy(graph.node(node).inputPorts) || {function: []})['function']
    var generics = (_.invertBy(graph.node(node).inputPorts) || {generic: []})['generic']
    var ports = _.compact(_.map(_.flatten(_.compact(_.concat(functions, generics))), (v) => '' + v))
    if (!graph.node(node).atomic && port) {
      ports = _.filter(ports, (p) => p === port)
    }
    if (graph.node(node).id === 'functional/partial' && port === 'value') {
      return ['value']
    }
    if (lambdaPort) {
      return []
    }
    if (ports.length === 0) {
      /* if (graph.node(node).inputPorts.fn) {
        console.error('dead end for ', node, port, graph.node(node).inputPorts.fn.arguments)
      }*/
      return null
    }
    return ports
  }, {keepPorts: true})
}

export function backtrackApply (graph, node) {
  // var applyPaths = backtrackLambda(graph, node)
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
  if (meta.type === 'reference') {
    return meta
  }
  var node = _(graph.nodes())
    .map((n) => ({v: n, value: graph.node(n)}))
    .find((n) => n.value.branchPath === meta)

  var mapGenerics = (type, key) => {
    if (type === 'generic') {
      return {type: 'type-ref', node: meta, port: key}
    }
    return type
  }

  var ins = _.mapValues(node.value.inputPorts, mapGenerics)
  var outs = _.mapValues(node.value.outputPorts, mapGenerics)

  var rKeys = _.keys(outs)
  return {
    type: 'function',
    arguments: ins,
    outputs: outs,
    return: (rKeys.length === 1) ? outs[rKeys[0]] : outs
  }
}

function isFunctionType (type) {
  return typeof (type) === 'object' && type.type === 'function'
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

var updatePorts = (node, ports, apply) => {
  return _.mapValues(ports, (p, portName) => {
    var srcType = apply.types[apply.index]
    var type
    if (p === 'function' || p === 'generic' || (p === 'function|function:return' && _.keys(srcType.arguments).length > 1)) {
      if (p === 'generic' && apply.lambda.port !== portName) {
        return 'generic'
      }
      if (p === 'function|function:return') {
        type = _.merge({}, _.omit(srcType, ['arguments', 'newArguments']), {arguments: srcType.newArguments})
      } else {
        type = srcType
      }
    } else if (p === 'function:return' || p === 'function|function:return') {
      type = srcType.return
      if (type === 'generic') {
        type = {type: 'type-ref', node: apply.implementation, port: _.keys(srcType.outputs)[0]}
      }
    } else if (p === 'function:arg') {
      var port = (srcType.partialize && srcType.partialize.port) ? srcType.partialize.port : _.keys(srcType.arguments)[0]
      type = srcType.arguments[port]
      if (type === 'generic') {
        type = {type: 'type-ref', node: apply.implementation, port: port}
      }
    }
    return type
  })
}

function partials (graph, apply) {
  return _.reduce(apply.path, (type, p) => {
    var pNode = graph.node(p.node)
    var lastType = _.cloneDeep((type.length > 0) ? _.last(type) : apply.type)
    if (lastType.newArguments) {
      lastType.arguments = lastType.newArguments
    }
    lastType = _.omit(lastType, ['partialize', 'newArguments'])
    if (pNode.id !== 'functional/partial' || p === _.last(apply.path)) {
      return type.concat(lastType)
    } else {
      var lambda = backtrackLambda(graph, {node: p.node, port: 'value'})
      if (lambda.length !== 0) {
        var impl = lambdaImplementation(graph, createApplyRule([lambda, p.node]))
        lambda = findFunctionType(graph, impl)
        var lambdaLambda = backtrackLambda(graph, {node: p.node, port: 'fn'})[0][0]
      } else if (utils.portType(graph, p.node, 'value') !== 'function:arg') {
        lambdaLambda = backtrackLambda(graph, {node: p.node, port: 'fn'})[0][0]
        lambda = utils.portType(graph, p.node, 'value')
      } else {
        lambda = null
      }
      return type.concat(_.merge({},
        lastType,
        {newArguments: _.omit(lastType.arguments, _.keys(lastType.arguments)[pNode.params.partial])},
        {partialize: {
          partial: p.node,
          port: _.keys(lastType.arguments)[pNode.params.partial],
          lambda: lambda,
          implementation: impl,
          applyTo: lambdaLambda
        }}))
    }
  }, [])
}

function lambdaImplementation (graph, res) {
  if (graph.node(res.lambda.node).params && graph.node(res.lambda.node).params.implementation) {
    return graph.node(res.lambda.node).params.implementation
  } else {
    return { type: 'reference', for: res.lambda, path: res.path }
  }
}

function createApplyRule (arr) {
  return {apply: arr[1], lambda: arr[0][0][0], path: arr[0][0]}
}

function partialFunctions (applys) {
  return _(applys)
    .map((a) => a.types)
    .flatten()
    .filter((t) => t.partialize && t.partialize.lambda)
    .value()
}

function resolveReferences (graph, pFuns, applys) {
  var partials = _.keyBy(pFuns, 'partialize.applyTo.node')
  return _.map(applys, (a) => {
    if (a.type.type === 'reference') {
      var pType = _.omit(partials[graph.parent(a.type.for.node)])
      var type = pType.partialize.lambda
      var impl = pType.partialize.implementation
      return _.merge({},
        _.omit(a, ['type', 'types', 'implementation']),
        {
          implementation: impl,
          type: type,
          types: _.map(a.types, (t) => type)
        })
    } else {
      return a
    }
  })
}

function applyLambdaTypes (graph) {
  var gr = utils.finalize(graph)
  return _.merge({}, graph, {
    nodes: _.map(graph.nodes, (n) => {
      if (n.value.id === 'functional/lambda' && n.value.outputPorts.fn === 'function') {
        return _.merge({}, n, {value: {outputPorts: {fn: findFunctionType(gr, n.value.params.implementation)}}})
      }
      return n
    })
  })
}

function hasUnfinishedFunctionEdges (graph) {
  var gr = utils.finalize(graph)
  return _.filter(graph.edges, (e) => {
    var vPort = utils.portType(gr, e.v, e.value.outPort)
    var wPort = utils.portType(gr, e.w, e.value.inPort)
    return ((vPort === 'generic' || vPort === 'function') && isFunctionType(wPort)) ||
      (isFunctionType(vPort) && (wPort === 'function' || wPort === 'generic'))
  }).length !== 0
}

function propagateFunctions (graph) {
  var gr = utils.finalize(graph)
  var changePorts = _.keyBy(_.compact(_.map(graph.edges, (e) => {
    var vPort = utils.portType(gr, e.v, e.value.outPort)
    var wPort = utils.portType(gr, e.w, e.value.inPort)
    if ((vPort === 'generic' || vPort === 'function') && isFunctionType(wPort)) {
      return {node: e.v, port: e.value.outPort, portType: 'outputPorts', type: wPort}
    } else if (isFunctionType(vPort) && (wPort === 'function' || wPort === 'generic')) {
      return {node: e.w, port: e.value.inPort, portType: 'inputPorts', type: vPort}
    }
  })), 'node')
  return _.merge({}, graph,
    {
      nodes: _.map(graph.nodes, (n) => {
        if (_.has(changePorts, n.v)) {
          n.value[changePorts[n.v].portType][changePorts[n.v].port] = changePorts[n.v].type
        }
        return n
      })
    })
}

function processApplications (graph, anodes) {
  var types = _(anodes)
    .map(_.partial(backtrackLambda, graph))
    .zip(anodes)
    .map((arr) => createApplyRule(arr))
    .map((res) => _.merge({}, res, {implementation: lambdaImplementation(graph, res)}))
    .map((res) => _.merge({}, res, {type: findFunctionType(graph, res.implementation)}))
    .map((res) => _.merge({}, res, {types: partials(graph, res)}))
    .value()
  var pFuns = partialFunctions(types)
  var ppaths = _(pFuns)
    .map((p) => {
      return { partial: p.partialize.partial, paths: backtrackLambda(graph, p.partialize.partial) }
    })
    .filter((p) => p.paths.length > 0)
    .map((p) => ({node: p.partial, port: 'value'}))
    .value()
  if (ppaths.length > 0) {
    // console.error(JSON.stringify(types, null, 2))
    graph = processApplications(graph, ppaths)
    types = _(anodes)
      .map(_.partial(backtrackLambda, graph))
      .zip(anodes)
      .map((arr) => createApplyRule(arr))
      .map((res) => _.merge({}, res, {implementation: lambdaImplementation(graph, res)}))
      .map((res) => _.merge({}, res, {type: findFunctionType(graph, res.implementation)}))
      .map((res) => _.merge({}, res, {types: partials(graph, res)}))
      .value()
    // console.error(types[0].types[3])
    // console.error(JSON.stringify(types, null, 2))
    pFuns = partialFunctions(types)
  }
  types = resolveReferences(graph, pFuns, types)
  var args = _.concat([{}], _.map(types, (t) => _.fromPairs(_.map(t.path, (p, idx) => [p.node, _.merge({}, t, {index: idx})]))))
  var applys = _.merge.apply(null, args)
  var editGraph = utils.edit(graph)
  editGraph = _.merge({}, editGraph, {
    nodes: _.map(editGraph.nodes, (n) => {
      if (!_.has(applys, n.v)) {
        return n
      } else if (_.find(anodes, (a) => a.node === n.v) && graph.node(n.v).id === 'functional/partial') {
        var appl = applys[n.v]
        return _.merge({}, n, {value:
        {
          inputPorts: _.merge({}, n.value.inputPorts, {value: appl.types[appl.index]})
        }})
      } else {
        return _.merge({}, n, {value:
        {
          inputPorts: updatePorts(n.v, n.value.inputPorts, applys[n.v]),
          outputPorts: updatePorts(n.v, n.value.outputPorts, applys[n.v])
        }})
      }
    })
  })
  return utils.finalize(editGraph)
}

export function resolveLambdaTypes (graph) {
  var anodes = applyNodes(graph)
  var resGraph = processApplications(graph, anodes)
  var editGraph = utils.edit(resGraph)
  editGraph = applyLambdaTypes(editGraph)
  var cnt = 0
  while (hasUnfinishedFunctionEdges(editGraph)) {
    editGraph = propagateFunctions(editGraph)
    cnt++
    if (cnt > 77) {
      console.error('maximum number of function propagations reached (77). Something is wrong.')
      process.exit(1)
    }
  }
  // console.log(hasUnfinishedFunctionEdges(editGraph))
  return utils.finalize(editGraph)
}
