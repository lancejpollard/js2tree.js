
this.w = 20

function x() {
  this.t = 10

  const a = () => {
    console.log(this)
  }

  a()
}

x()
