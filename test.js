
const t = require('.')
const print = require('./print')

log`
const a = 10
const x = a + 20
const x2 = function(y) { console.log('foo') }
`

function log(x) {
  const ast = t(x[0])
  const text = print(ast)
  console.log(text)
}
