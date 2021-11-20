
```
const f = x => x * 2

task f
  base x
  call multiply
    bind a, link x
    bind b, size 2
    turn seed
```

```
const f1 = 10

host f1, size 10
```

```
let f2 = 10

host f2, size 10
  lock free
```
