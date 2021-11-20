
const n = require('@lancejpollard/normalize-ast.js')
const {
  createTask,
  createHostZone,
  createBase,
  createCall,
  createSave,
  createSize,
  createText,
  createBind,
  createCallSave,
} = require('./create')

// const transforms = buildTransforms(Type)

const transforms = {
  ExpressionStatement: transformExpressionStatement,
  VariableDeclaration: transformVariableDeclarationStandalone,
  AssignmentExpression: transformAssignmentExpression,
  FunctionExpression: transformFunctionExpression,
  Literal: transformLiteral,
  BinaryExpression: transformBinaryExpression,
  Identifier: transformIdentifier,
  CallExpression: transformCallExpression,
  MemberExpression: transformMemberExpression,
  ReturnStatement: transformReturnStatement,
  IfStatement: transformIfStatement,
  BlockStatement: transformBlockStatement,
  WhileStatement: transformWhileStatement,
  BreakStatement: transformBreakStatement,
  LogicalExpression: transformLogicalExpression,
  ObjectExpression: transformObjectExpression,
  Property: transformProperty,
  ArrayExpression: transformArrayExpression,
  SpreadElement: transformSpreadElement,
  FunctionDeclaration: transformFunctionDeclaration,
  UnaryExpression: transformUnaryExpression,
  UpdateExpression: transformUpdateExpression,
}

const binaries = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
  '||': 'or',
  '&&': 'and',
  '~': 'bitflip',
  '-': 'negative',
  '&': 'bitwise-and',
  '|': 'bitwise-or',
  '>>>': 'unsigned-shift-right',
  '>>': 'shift-right',
  '<<': 'shift-left',
  '++': 'increment',
  '--': 'decrement',
  '+=': 'increment-by',
  '-=': 'decrement-by',
  '^': 'xor',
  '<': 'lt',
  '>': 'gt',
  '<=': 'lte',
  '>=': 'gte',
  '%': 'modulo',
  '!': 'not'
}

module.exports = transform

function transform(source) {
  const node = n.normalize(n.parse(source))
  const nodes = []
  const scope = { index: 0 }
  node.body.forEach(bd => {
    const t = transformBodyNode(bd, scope)
    if (Array.isArray(t)) {
      nodes.push(...t)
    } else {
      nodes.push(t)
    }
  })
  return nodes
}

function transformUpdateExpression(node, scope) {
  let value = transformOptionallyToLink(call(transforms, node.argument.type, node.argument, scope))
  const name = toTerm(transformName(node.operator))
  return createCall(name, [
    createBind(toTerm('value'), value)
  ])
}

function transformUnaryExpression(node, scope) {
  const argument = call(transforms, node.argument.type, node.argument, scope)
  const name = toTerm(transformName(node.operator))
  return createCall(name, [
    createBind(toTerm('bits'), argument)
  ])
}

function transformFunctionDeclaration(node, scope) {
  const base = []
  const name = `tmp${scope.index++}`
  node.params.forEach(param => {
    base.push(createBase(param.name))
  })
  const zone = []
  node.body.body.forEach(bd => {
    const t = call(transforms, bd.type, bd, scope)
    if (Array.isArray(t)) {
      zone.push(...t)
    } else {
      zone.push(t)
    }
  })
  return createTask(name, base, zone)
}

function transformProperty(node, scope) {
  const key = call(transforms, node.key.type, node.key, scope)
  let value = transformOptionallyToLink(call(transforms, node.value.type, node.value, scope))
  return createBind(key, value)
}

function transformSpreadElement(node, scope) {
  const argument = call(transforms, node.argument.type, node.argument, scope)
  return {
    form: 'rest',
    site: argument
  }
}

function transformArrayExpression(node, scope) {
  const properties = []
  node.elements.forEach(p => {
    let value = transformOptionallyToLink(call(transforms, p.type, p, scope))
    properties.push(createBind(value))
  })

  return {
    form: 'make',
    name: toTerm('list'),
    bind: properties
  }
}

function transformBreakStatement(node, scope) {
  return {
    form: 'turn',
    site: {
      form: 'term',
      term: 'false'
    }
  }
}

function transformObjectExpression(node, scope) {
  const properties = []
  node.properties.forEach(p => {
    properties.push(call(transforms, p.type, p, scope))
  })
  return {
    form: 'make',
    name: toTerm('object'),
    bind: properties
  }
}

function transformLogicalExpression(node, scope) {
  const left = call(transforms, node.left.type, node.left, scope)
  const right = call(transforms, node.right.type, node.right, scope)
  const operator = transformName(node.operator)
  const name = toTerm(operator)
  return createCall(name, [
    createBind(toTerm('a'), left),
    createBind(toTerm('b'), right)
  ])
}

function transformName(key) {
  if (!binaries[key]) throw new Error(key)
  return binaries[key]
}

function transformWhileStatement(node, scope) {
  const test = call(transforms, node.test.type, node.test, scope)
  const body = call(transforms, node.body.type, node.body, scope)
  const bind = [

  ]
  const lastCall = body[body.length - 1]
  // lastCall.zone.push({
  //   form: 'call-turn',
  //   term: 'seed'
  // })
  const lastHook = lastCall.hook
  lastCall.hook = {}
  const hook = {
    test: {
      form: 'hook',
      base: [],
      zone: body
    },
    ...lastHook
  }
  const name = toTerm('loop')
  const c = createCall(name, bind, hook)
  return c
}

function transformBlockStatement(node, scope) {
  const nodes = []
  node.body.forEach(bd => {
    const x = call(transforms, bd.type, bd, scope)
    if (Array.isArray(x)) {
      nodes.push(...x)
    } else {
      nodes.push(x)
    }
  })
  return nodes
}

function transformReturnStatement(node, scope) {
  const site = node.argument && call(transforms, node.argument.type, node.argument, scope)
  return {
    form: 'turn',
    site
  }
}

function transformIfStatement(node, scope) {
  const test = call(transforms, node.test.type, node.test, scope)
  const consequent = call(transforms, node.consequent.type, node.consequent, scope)
  const alternate = node.alternate && call(transforms, node.alternate.type, node.alternate, scope)
  const bind = [
    createBind(toTerm('test'), { form: 'link', site: test })
  ]
  const hook = {}
  hook.match = {
    form: 'hook',
    base: [],
    zone: consequent
  }
  if (alternate) {
    hook.fault = {
      form: 'hook',
      base: [],
      zone: Array.isArray(alternate) ? alternate : [alternate]
    }
  }
  const name = toTerm('check')
  return createCall(name, bind, hook)
}

function transformVariableDeclarationStandalone(node, scope) {
  const list = []
  node.declarations.forEach(dec => {
    const init = dec.init && call(transforms, dec.init.type, dec.init, scope)
    const id = call(transforms, dec.id.type, dec.id, scope)
    if (init && init.form === 'call') {
      const save = createSave(id, init)
      list.push(save)
    } else {
      list.push(createHostZone(id, transformOptionallyToLink(init)))
    }
  })
  return list
}

function transformBodyNode(node, scope) {
  return call(transforms, node.type, node, scope)
}

function transformMemberExpression(node, scope) {
  const object = call(transforms, node.object.type, node.object, scope)
  const property = call(transforms, node.property.type, node.property, scope)
  const computed = node.computed
  return {
    form: 'site',
    host: object,
    link: property,
    bond: computed
  }
}

function transformCallExpression(node, scope) {
  const name = call(transforms, node.callee.type, node.callee, scope)
  const bind = []
  node.arguments.forEach(arg => {
    let value = transformOptionallyToLink(call(transforms, arg.type, arg, scope))
    bind.push(createBind(value))
  })
  return {
    form: 'call',
    name,
    bind,
    hook: {},
    zone: []
  }
}

function toTerm(term) {
  return {
    form: 'term',
    term
  }
}

function transformIdentifier(node, scope) {
  return toTerm(node.name)
}

function transformOptionallyToLink(site) {
  if (!site) return site
  switch (site.form) {
    case 'site': return { form: 'link', site }
    case 'term': return { form: 'link', site }
  }
  return site
}

function transformBinaryExpression(node, scope) {
  const name = toTerm(transformName(node.operator))
  const bind = []
  let left = transformOptionallyToLink(call(transforms, node.left.type, node.left, scope))
  let right = transformOptionallyToLink(call(transforms, node.right.type, node.right, scope))
  bind.push(createBind(toTerm('a'), left))
  bind.push(createBind(toTerm('b'), right))
  return createCall(name, bind)
}

function transformLiteral(node, scope) {
  switch (typeof node.value) {
    case 'number': return createSize(node.value)
    case 'string': return createText(node.value)
    case 'boolean': return createTerm(node.value)
  }
}

function createTerm(value) {
  return {
    form: 'term',
    name: String(value)
  }
}

function transformAssignmentExpression(node, scope) {
  const left = call(transforms, node.left.type, node.left, scope)
  const right = transformOptionallyToLink(call(transforms, node.right.type, node.right, scope))
  return createSave(left, right)
}

function transformFunctionExpression(node, scope) {
  const base = []
  const name = `tmp${scope.index++}`
  node.params.forEach(param => {
    base.push(createBase(param.name))
  })
  const zone = []
  node.body.body.forEach(bd => {
    const t = call(transforms, bd.type, bd, scope)
    if (Array.isArray(t)) {
      zone.push(...t)
    } else {
      zone.push(t)
    }
  })
  return createTask(name, base, zone)
}

function transformExpressionStatement(node, scope) {
  return call(transforms, node.expression.type, node.expression, scope)
}

function call(obj, method, ...args) {
  if (!obj.hasOwnProperty(method)) {
    throw new Error(`Missing method ${method}`)
  }

  return obj[method](...args)
}
