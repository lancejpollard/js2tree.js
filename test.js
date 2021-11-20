
const t = require('.')
const print = require('./print')

log`
const a = 10
const x = a + 20
const y = a * b
const x2 = function(y) { console.log('foo') }
const [a1, b1] = a
const y2 = function(a = 1) {
  return a * 2
}
const y3 = function(x, y) {
  if (x) {
    y()
  } else if (z) {
    z()
  }
}
const y4 = function() {
  while (a().b().x) {
    console.log('foo')
  }
}
if (x) { y() }
const y5 = a || b
const y6 = a[z]() && b.y()
const y7 = {}
const y8 = { foo: 'bar' }
const y9 = { foo: x().y }
const y10 = []
const y11 = [1, 2, 3]
const y12 = [{a}, {b}, {c}]
const y13 = [...a]
const y14 = { ...a }
const y15 = { a: {b} }
`

function log(x) {
  const ast = t(x[0])
  const text = print(ast)
  console.log(text)
}
