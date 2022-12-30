const common = require("../common")

const { assert } = common
// const fake = common.fake.create()
const retry = require(`${common.dir.lib}/retry`)

function getLib() {
  return {
    fn1() {},
    fn2() {},
    fn3() {},
  }
}

;(function wrapAll() {
  const lib = getLib()
  retry.wrap(lib)
  assert.equal(lib.fn1.name, "bound retryWrapper")
  assert.equal(lib.fn2.name, "bound retryWrapper")
  assert.equal(lib.fn3.name, "bound retryWrapper")
})()
;(function wrapAllPassOptions() {
  const lib = getLib()
  retry.wrap(lib, { retries: 2 })
  assert.equal(lib.fn1.name, "bound retryWrapper")
  assert.equal(lib.fn2.name, "bound retryWrapper")
  assert.equal(lib.fn3.name, "bound retryWrapper")
  assert.equal(lib.fn1.options.retries, 2)
  assert.equal(lib.fn2.options.retries, 2)
  assert.equal(lib.fn3.options.retries, 2)
})()
;(function wrapDefined() {
  const lib = getLib()
  retry.wrap(lib, ["fn2", "fn3"])
  assert.notEqual(lib.fn1.name, "bound retryWrapper")
  assert.equal(lib.fn2.name, "bound retryWrapper")
  assert.equal(lib.fn3.name, "bound retryWrapper")
})()
;(function wrapDefinedAndPassOptions() {
  const lib = getLib()
  retry.wrap(lib, { retries: 2 }, ["fn2", "fn3"])
  assert.notEqual(lib.fn1.name, "bound retryWrapper")
  assert.equal(lib.fn2.name, "bound retryWrapper")
  assert.equal(lib.fn3.name, "bound retryWrapper")
  assert.equal(lib.fn2.options.retries, 2)
  assert.equal(lib.fn3.options.retries, 2)
})()
;(function runWrappedWithoutError() {
  let callbackCalled
  const lib = {
    method(a, b, callback) {
      assert.equal(a, 1)
      assert.equal(b, 2)
      assert.equal(typeof callback, "function")
      callback()
    },
  }
  retry.wrap(lib)
  lib.method(1, 2, () => {
    callbackCalled = true
  })
  assert.ok(callbackCalled)
})()
;(function runWrappedSeveralWithoutError() {
  let callbacksCalled = 0
  const lib = {
    fn1(a, callback) {
      assert.equal(a, 1)
      assert.equal(typeof callback, "function")
      callback()
    },
    fn2(a, callback) {
      assert.equal(a, 2)
      assert.equal(typeof callback, "function")
      callback()
    },
  }
  retry.wrap(lib, {}, ["fn1", "fn2"])
  lib.fn1(1, () => {
    callbacksCalled++
  })
  lib.fn2(2, () => {
    callbacksCalled++
  })
  assert.equal(callbacksCalled, 2)
})()
;(function runWrappedWithError() {
  let callbackCalled
  const lib = {
    method(callback) {
      callback(new Error("Some error"))
    },
  }
  retry.wrap(lib, { retries: 1 })
  lib.method((err) => {
    callbackCalled = true
    assert.ok(err instanceof Error)
  })
  assert.ok(!callbackCalled)
})()
