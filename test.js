
const t = require('.')
const print = require('./print')
const fs = require('fs')
// const text = fs.readFileSync('test.js', 'utf-8')

log`
// const a = 10
// const x = a + 20 - (b * c - 1) - (2 * d + 4 - e) + 5
// const y = a * b
// const x2 = function(y) { return y * 2 }
// const x3 = function(y) { console.log('foo') }
// const [a1, b1] = a
// const y2 = function(a = 1) {
//   return a * 2
// }
// const y3 = function(x, y) {
//   if (x) {
//     y()
//   } else if (z) {
//     z()
//   }
// }

// const y31 = function(x, y) {
//   if (x) {
//     y()
//   } else {
//     z()
//   }
// }
// const y4 = function() {
//   while (a(1, c).b().x) {
//     console.log('foo')
//   }
// }

// const y41 = function() {
//   while (true) {
//     console.log('foo')
//   }
// }
// if (x) { y() }
// const q1 = a[z]
// const q2 = a[z.b]
// const q3 = a[z.b.c]
// const q4 = a[z.b[e.f].c]
// const q5 = a[z.b[e(w * 2).f].c]
// a.b.c = x
// a.b[e.f].c += x
// a.b[e.f()].c += x
// a.b[e.f(1, w)].c += x
// a().b[e.f(1, ((w - z) / (2 * p)) + 3)].c -= x
// const y5 = (a || b || c) && d
// const y6 = a[z](w * 2 + 1) && b.y()
// const y7 = {}
// const y8 = { foo: 'bar' }
// const y9 = { foo: x().y }
// const y10 = []
// const y11 = [1, 2, 3]
// const y12 = [{a}, {b}, {c}]
// const y13 = [...a]
// const y14 = { ...a }
// const y15 = { a: {b} }
// switch (x) {
//   case y:
//     console.log(z)
//     break
// }
// function x10(a = 1) { console.log(a) }
function doReset() {
  if (this._nRounds && this._keyPriorReset === this._key) {
      return;
  }
}
`

function log(x) {
  // const ast = t(x[0])
  // const text = print(ast)
  // console.log(text)
  // fs.writeFileSync('libs/md5.link', text)
}

fs.writeFileSync('libs/test.link', print(t(fs.readFileSync('libs/test.js', 'utf-8'))))
