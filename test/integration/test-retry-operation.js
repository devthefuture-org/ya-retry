const common = require("../common")

const { assert } = common
const fake = common.fake.create()
const retry = require(`${common.dir.lib}/retry`)

;(function testReset() {
  const error = new Error("some error")
  const operation = retry.operation([1, 2, 3])
  let attempts = 0

  const finalCallback = fake.callback("finalCallback")
  fake.expectAnytime(finalCallback)

  let expectedFinishes = 1
  let finishes = 0

  const fn = function () {
    operation.attempt((currentAttempt) => {
      attempts++
      assert.equal(currentAttempt, attempts)
      if (operation.retry(error)) {
        return
      }

      finishes++
      assert.equal(expectedFinishes, finishes)
      assert.strictEqual(attempts, 4)
      assert.strictEqual(operation.attempts(), attempts)
      assert.strictEqual(operation.mainError(), error)

      if (finishes < 2) {
        attempts = 0
        expectedFinishes++
        operation.reset()
        fn()
      } else {
        finalCallback()
      }
    })
  }

  fn()
})()
;(function testErrors() {
  const operation = retry.operation()

  const error = new Error("some error")
  const error2 = new Error("some other error")
  operation._errors.push(error)
  operation._errors.push(error2)

  assert.deepEqual(operation.errors(), [error, error2])
})()
;(function testMainErrorReturnsMostFrequentError() {
  const operation = retry.operation()
  const error = new Error("some error")
  const error2 = new Error("some other error")

  operation._errors.push(error)
  operation._errors.push(error2)
  operation._errors.push(error)

  assert.strictEqual(operation.mainError(), error)
})()
;(function testMainErrorReturnsLastErrorOnEqualCount() {
  const operation = retry.operation()
  const error = new Error("some error")
  const error2 = new Error("some other error")

  operation._errors.push(error)
  operation._errors.push(error2)

  assert.strictEqual(operation.mainError(), error2)
})()
;(function testAttempt() {
  const operation = retry.operation()
  const fn = function () {}

  const timeoutOpts = {
    timeout: 1,
    cb() {},
  }
  operation.attempt(fn, timeoutOpts)

  assert.strictEqual(fn, operation._fn)
  assert.strictEqual(timeoutOpts.timeout, operation._operationTimeout)
  assert.strictEqual(timeoutOpts.cb, operation._operationTimeoutCb)
})()
;(function testRetry() {
  const error = new Error("some error")
  const operation = retry.operation([1, 2, 3])
  let attempts = 0

  const finalCallback = fake.callback("finalCallback")
  fake.expectAnytime(finalCallback)

  const fn = function () {
    operation.attempt((currentAttempt) => {
      attempts++
      assert.equal(currentAttempt, attempts)
      if (operation.retry(error)) {
        return
      }

      assert.strictEqual(attempts, 4)
      assert.strictEqual(operation.attempts(), attempts)
      assert.strictEqual(operation.mainError(), error)
      finalCallback()
    })
  }

  fn()
})()
;(function testRetryForever() {
  const error = new Error("some error")
  const operation = retry.operation({ retries: 3, forever: true })
  let attempts = 0

  const finalCallback = fake.callback("finalCallback")
  fake.expectAnytime(finalCallback)

  const fn = function () {
    operation.attempt((currentAttempt) => {
      attempts++
      assert.equal(currentAttempt, attempts)
      if (attempts !== 6 && operation.retry(error)) {
        return
      }

      assert.strictEqual(attempts, 6)
      assert.strictEqual(operation.attempts(), attempts)
      assert.strictEqual(operation.mainError(), error)
      finalCallback()
    })
  }

  fn()
})()
;(function testRetryForeverNoRetries() {
  const error = new Error("some error")
  const delay = 50
  const operation = retry.operation({
    retries: null,
    forever: true,
    minTimeout: delay,
    maxTimeout: delay,
  })

  let attempts = 0
  const startTime = new Date().getTime()

  const finalCallback = fake.callback("finalCallback")
  fake.expectAnytime(finalCallback)

  const fn = function () {
    operation.attempt((currentAttempt) => {
      attempts++
      assert.equal(currentAttempt, attempts)
      if (attempts !== 4 && operation.retry(error)) {
        return
      }

      const endTime = new Date().getTime()
      const minTime = startTime + delay * 3
      const maxTime = minTime + 20 // add a little headroom for code execution time
      assert(endTime >= minTime)
      assert(endTime < maxTime)
      assert.strictEqual(attempts, 4)
      assert.strictEqual(operation.attempts(), attempts)
      assert.strictEqual(operation.mainError(), error)
      finalCallback()
    })
  }

  fn()
})()
;(function testStop() {
  const error = new Error("some error")
  const operation = retry.operation([1, 2, 3])
  let attempts = 0

  const finalCallback = fake.callback("finalCallback")
  fake.expectAnytime(finalCallback)

  const fn = function () {
    operation.attempt((currentAttempt) => {
      attempts++
      assert.equal(currentAttempt, attempts)

      if (attempts === 2) {
        operation.stop()

        assert.strictEqual(attempts, 2)
        assert.strictEqual(operation.attempts(), attempts)
        assert.strictEqual(operation.mainError(), error)
        finalCallback()
      }

      operation.retry(error)
    })
  }

  fn()
})()
;(function testMaxRetryTime() {
  const error = new Error("some error")
  const maxRetryTime = 30
  const operation = retry.operation({
    minTimeout: 1,
    maxRetryTime,
  })
  let attempts = 0

  const finalCallback = fake.callback("finalCallback")
  fake.expectAnytime(finalCallback)

  const longAsyncFunction = function (wait, callback) {
    setTimeout(callback, wait)
  }

  const fn = function () {
    const startTime = new Date().getTime()
    operation.attempt((currentAttempt) => {
      attempts++
      assert.equal(currentAttempt, attempts)

      if (attempts !== 2) {
        operation.retry(error)
      } else {
        const curTime = new Date().getTime()
        longAsyncFunction(maxRetryTime - (curTime - startTime - 1), () => {
          if (operation.retry(error)) {
            assert.fail("timeout should be occurred")
            return
          }

          assert.strictEqual(operation.mainError(), error)
          finalCallback()
        })
      }
    })
  }

  fn()
})()
;(function testErrorsPreservedWhenMaxRetryTimeExceeded() {
  const error = new Error("some error")
  const maxRetryTime = 30
  const operation = retry.operation({
    minTimeout: 1,
    maxRetryTime,
  })

  const finalCallback = fake.callback("finalCallback")
  fake.expectAnytime(finalCallback)

  const longAsyncFunction = function (wait, callback) {
    setTimeout(callback, wait)
  }

  const fn = function () {
    const startTime = new Date().getTime()
    operation.attempt(() => {
      const curTime = new Date().getTime()
      longAsyncFunction(maxRetryTime - (curTime - startTime - 1), () => {
        if (operation.retry(error)) {
          assert.fail("timeout should be occurred")
          return
        }

        assert.strictEqual(operation.mainError(), error)
        finalCallback()
      })
    })
  }

  fn()
})()
