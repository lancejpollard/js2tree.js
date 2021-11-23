
const n = require('@lancejpollard/normalize-ast.js')
const to = require('to-case')
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
  ContinueStatement: transformContinueStatement,
  LogicalExpression: transformLogicalExpression,
  ObjectExpression: transformObjectExpression,
  Property: transformProperty,
  ArrayExpression: transformArrayExpression,
  SpreadElement: transformSpreadElement,
  FunctionDeclaration: transformFunctionDeclaration,
  UnaryExpression: transformUnaryExpression,
  UpdateExpression: transformUpdateExpression,
  EmptyStatement: transformEmptyStatement,
  ThrowStatement: transformThrowStatement,
  NewExpression: transformNewExpression,
  ThisExpression: transformThisExpression,
  ForInStatement: transformForInStatement,
  SwitchStatement: transformSwitchStatement,
  TemplateLiteral: transformTemplateLiteral,
  TemplateElement: transformTemplateElement,
  TryStatement: transformTryStatement,
  CatchClause: transformCatchClause,
  AssignmentPattern: transformAssignmentPattern,
  SwitchCase: transformSwitchCase,
  ClassDeclaration: transformClassDeclaration,
  ClassBody: transformClassBody,
  MethodDefinition: transformMethodDefinition,
}

const binaries = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
  '||': 'or',
  '&&': 'and',
  '&': 'bitwise-and',
  '|': 'bitwise-or',
  '>>>': 'unsigned-shift-right',
  '>>': 'shift-right',
  '<<': 'shift-left',
  '+=': 'assign-increment',
  '-=': 'assign-decrement',
  '*=': 'assign-multiple',
  '/=': 'assign-division',
  '%=': 'assign-modulo',
  '**=': 'assign-exponent',
  '<<=': 'assign-left-shift',
  '>>=': 'assign-right-shift',
  '>>>=': 'assign-unsigned-right-shift',
  '&=': 'assign-bitwise-and',
  '^=': 'assign-bitwise-xor',
  '|=': 'assign-bitwise-or',
  '??': 'nullish',
  '^': 'bitwise-xor',
  '==': 'equal',
  '===': 'strictly-equal',
  '!==': 'not-strictly-equal',
  '!=': 'not-equal',
  '<': 'lt',
  '>': 'gt',
  '<=': 'lte',
  '>=': 'gte',
  '%': 'modulo',
  'instanceof': 'get-instance-of'
}

const unaries = {
  '!': 'not',
  'typeof': 'get-type-of',
  '~': 'bitflip',
  '-': 'negative',
  '+': 'numeralize',
  '++': 'increment',
  '--': 'decrement',
  'delete': 'delete'
}

module.exports = transform

function transform(source) {
  const node = n.normalize(n.parse(source))
  const nodes = []
  const scope = { index: 0, names: {} }
  node.body.forEach(bd => {
    const t = transformBodyNode(bd, scope)
    if (Array.isArray(t)) {
      nodes.push(...t)
    } else {
      nodes.push(t)
    }
  })
  nodes.forEach(node => walk(node, scope))
  return nodes
}

function transformClassDeclaration(node, scope) {
  const id = call(transforms, node.id.type, node.id, scope)
  const superClass = node.superClass && call(transforms, node.superClass.type, node.superClass, scope)
  const body = call(transforms, node.body.type, node.body, scope)
  const form = {
    form: 'form',
    name: id,
    base: [],
    task: []
  }
  body.forEach(bd => {
    if (bd.form === 'task') {
      form.task.push(bd)
    }
  })
  return form
}

function transformMethodDefinition(node, scope) {
  const key = call(transforms, node.key.type, node.key, scope)
  const value = call(transforms, node.value.type, node.value, scope)
  value.name = key
  return value
}

function transformClassBody(node, scope) {
  const body = []
  node.body.forEach(bd => {
    const out = call(transforms, bd.type, bd, scope)
    body.push(out)
  })
  return body
}

function transformSwitchCase(node, scope) {
  const test = node.test && call(transforms, node.test.type, node.test, scope)
  const consequent = []
  node.consequent.forEach(csq => {
    const cons = call(transforms, csq.type, csq, scope)
    if (Array.isArray(cons)) {
      consequent.push(...cons)
    } else {
      consequent.push(cons)
    }
  })
  return [test, consequent]
}

function transformTryStatement(node, scope) {
  const block = call(transforms, node.block.type, node.block, scope)
  const handler = call(transforms, node.handler.type, node.handler, scope)
  const finalizer = node.finalizer && call(transforms, node.finalizer.type, node.finalizer, scope)
  const hook = [
    {
      name: 'block',
      base: [],
      zone: block
    },
    handler
  ]
  if (finalizer) {
    hook.push({
      name: 'after',
      base: [],
      zone: finalizer
    })
  }
  return createCall(toTerm('try'), [], hook)
}

function transformCatchClause(node, scope) {
  const param = node.param && call(transforms, node.param.type, node.param, scope)
  const body = call(transforms, node.body.type, node.body, scope)
  const hook = {
    form: 'hook',
    name: 'fault',
    base: [],
    zone: body
  }
  if (param) {
    hook.base.push(createBase(param))
  }
  return hook
}

function transformAssignmentPattern(node, scope) {
  const left = call(transforms, node.left.type, node.left, scope)
  const right = call(transforms, node.right.type, node.right, scope)
  return [left, right]
}

function transformTemplateLiteral(node, scope) {
  const expressions = []
  node.expressions.forEach(exp => {
    const expression = call(transforms, exp.type, exp, scope)
    expressions.push(expression)
  })
  const quasis = []
  node.quasis.forEach(qua => {
    const quasi = call(transforms, qua.type, qua, scope)
    quasis.push(quasi)
  })
  const lace = []
  quasis.forEach((q, i) => {
    lace.push({ form: 'text', text: q })
    if (i < quasis.length - 1) {
      const expression = transformOptionallyToLink(expressions[i])
      lace.push(expression)
    }
  })
  return {
    form: 'lace',
    list: lace
  }
}

function transformTemplateElement(node, scope) {
  return node.value.raw
}

function transformForInStatement(node, scope) {
  const name = toTerm('walk-keys')
  const key = node.left.name ?? node.left.declarations[0].id.name
  const object = transformOptionallyToLink(call(transforms, node.right.type, node.right, scope))
  const body = call(transforms, node.body.type, node.body, scope)
  const bind = [
    createBind(toTerm('object'), object)
  ]
  const hook = [
    {
      name: 'link',
      base: [createBase(toTerm('key'))],
      zone: body
    }
  ]
  return createCall(name, bind, hook)
}

function transformSwitchStatement(node, scope) {
  const discriminant = call(transforms, node.discriminant.type, node.discriminant, scope)
  const cases = []
  node.cases.forEach(cse => {
    const c = call(transforms, cse.type, cse, scope)
    cases.push(c)
  })
  const hook = []
  cases.forEach(([test, consequent]) => {
    if (test) {
      hook.push({
        name: 'test',
        base: [],
        zone: [
          createCall(toTerm('check-equal'), [
            createBind(transformOptionallyToLink(discriminant)),
            createBind(transformOptionallyToLink(test))
          ])
        ]
      })
      hook.push({
        name: 'match',
        base: [],
        zone: consequent
      })
    } else {
      hook.push({
        name: 'fault',
        base: [],
        zone: consequent
      })
    }
  })
  return createCall(toTerm('match-first'), [], hook)
}

function walk(node, scope) {
  if (!node || typeof node !== 'object') {
    return
  }

  if (node.form === 'term') {
    normalizeName(node, scope)
  }

  Object.keys(node).forEach(key => {
    const val = node[key]
    if (Array.isArray(val)) {
      val.forEach(v => walk(v, scope))
    } else {
      walk(val, scope)
    }
  })
}

function transformThisExpression(node, scope) {
  return toTerm('host')
}

function transformThrowStatement(node, scope) {
  const argument = call(transforms, node.argument.type, node.argument, scope)
  return {
    form: 'halt',
    site: argument
  }
}

function transformNewExpression(node, scope) {
  const bind = []
  const name = call(transforms, node.callee.type, node.callee, scope)
  node.arguments.forEach(arg => {
    const value = transformOptionallyToLink(call(transforms, arg.type, arg, scope))
    bind.push(createBind(value))
  })
  return {
    form: 'make',
    name,
    bind
  }
}

function transformEmptyStatement(node, scope) {

}

function transformUpdateExpression(node, scope) {
  let value = transformOptionallyToLink(call(transforms, node.argument.type, node.argument, scope))
  const name = toTerm(transformName(node.operator, unaries))
  return createCall(name, [
    createBind(toTerm('value'), value)
  ])
}

function transformUnaryExpression(node, scope) {
  const argument = transformOptionallyToLink(call(transforms, node.argument.type, node.argument, scope))
  const name = toTerm(transformName(node.operator, unaries))
  return createCall(name, [
    createBind(toTerm('bits'), argument)
  ])
}

function normalizeName(term, scope) {
  if (typeof scope.names[term.term] !== 'string') {
    scope.names[term.term] = to.slug(term.term)
  }
  term.term = scope.names[term.term]
  return term
}

function transformFunctionDeclaration(node, scope) {
  const base = []
  const id = node.id && call(transforms, node.id.type, node.id, scope)
  const name = id ?? { form: 'term', term: `tmp${scope.index++}` }
  node.params.forEach(param => {
    const p = call(transforms, param.type, param, scope)
    if (Array.isArray(p)) {
      base.push(createBase(toTerm(p[0].term), { miss: p[1] }))
    } else {
      base.push(createBase(p))
    }
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

function transformContinueStatement(node, scope) {
  return {
    form: 'turn',
    site: {
      form: 'term',
      term: 'true'
    }
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
    const value = call(transforms, p.type, p, scope)
    properties.push(value)
  })
  return {
    form: 'make',
    name: toTerm('object'),
    bind: properties
  }
}

function transformLogicalExpression(node, scope) {
  const left = transformOptionallyToLink(call(transforms, node.left.type, node.left, scope))
  const right = transformOptionallyToLink(call(transforms, node.right.type, node.right, scope))
  const operator = transformName(node.operator)
  const name = toTerm(operator)
  return createCall(name, [
    createBind(toTerm('a'), left),
    createBind(toTerm('b'), right)
  ])
}

function transformName(key, x = binaries) {
  if (!x.hasOwnProperty(key)) throw new Error(key)
  return x[key]
}

function transformWhileStatement(node, scope) {
  const test = call(transforms, node.test.type, node.test, scope)
  const body = call(transforms, node.body.type, node.body, scope)
  const bind = [

  ]
  const lastCall = body[body.length - 1]
  const lastHook = lastCall.hook
  // TODO: fix this
  lastCall.hook = []
  const hook = [
    {
      name: 'test',
      form: 'hook',
      base: [],
      zone: body
    },
    ...lastHook
  ]
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
  const hook = []
  hook.push({
    name: 'match',
    form: 'hook',
    base: [],
    zone: consequent
  })
  if (alternate) {
    hook.push({
      name: 'fault',
      form: 'hook',
      base: [],
      zone: Array.isArray(alternate) ? alternate : [alternate]
    })
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
    if (!value) value = transformOptionallyToLink({ form: 'term', term: 'null' })
    bind.push(createBind(value))
  })
  return {
    form: 'call',
    name,
    bind,
    hook: [],
    zone: []
  }
}

function toTerm(term) {
  if (!term) throw new Error('Missing term')
  const obj = {
    form: 'term',
    term
  }
  return obj
}

function transformIdentifier(node, scope) {
  return toTerm(node.name)
}

function transformOptionallyToLink(site) {
  if (!site) return site
  switch (site.form) {
    case 'site': return { form: 'link', site }
    case 'term':
      if (site.term === 'undefined') {
        site.term = 'void'
      }
      return { form: 'link', site }
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
    case 'string': return createText(node.raw.substr(1, node.raw.length - 2))
    case 'boolean': return createTerm(node.value)
  }
}

function createTerm(value) {
  return {
    form: 'term',
    term: String(value)
  }
}

function transformAssignmentExpression(node, scope) {
  const left = call(transforms, node.left.type, node.left, scope)
  const right = transformOptionallyToLink(call(transforms, node.right.type, node.right, scope))
  return createSave(left, right)
}

function transformFunctionExpression(node, scope) {
  const base = []
  const id = node.id && call(transforms, node.id.type, node.id, scope)
  const name = id ?? { form: 'term', term: `tmp${scope.index++}` }
  node.params.forEach(param => {
    const p = call(transforms, param.type, param, scope)
    if (Array.isArray(p)) {
      base.push(createBase(toTerm(p[0].term), { miss: p[1] }))
    } else {
      base.push(createBase(p))
    }
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
