const common = require("../common")

const { assert } = common
const retry = require(`${common.dir.lib}/retry`)

;(function testDefaultValues() {
  const timeouts = retry.timeouts()

  assert.equal(timeouts.length, 10)
  assert.equal(timeouts[0], 1000)
  assert.equal(timeouts[1], 2000)
  assert.equal(timeouts[2], 4000)
})()
;(function testDefaultValuesWithRandomize() {
  const minTimeout = 5000
  const timeouts = retry.timeouts({
    minTimeout,
    randomize: true,
  })

  assert.equal(timeouts.length, 10)
  assert.ok(timeouts[0] > minTimeout)
  assert.ok(timeouts[1] > timeouts[0])
  assert.ok(timeouts[2] > timeouts[1])
})()
;(function testPassedTimeoutsAreUsed() {
  const timeoutsArray = [1000, 2000, 3000]
  const timeouts = retry.timeouts(timeoutsArray)
  assert.deepEqual(timeouts, timeoutsArray)
  assert.notStrictEqual(timeouts, timeoutsArray)
})()
;(function testTimeoutsAreWithinBoundaries() {
  const minTimeout = 1000
  const maxTimeout = 10000
  const timeouts = retry.timeouts({
    minTimeout,
    maxTimeout,
  })
  for (let i = 0; i < timeouts; i++) {
    assert.ok(timeouts[i] >= minTimeout)
    assert.ok(timeouts[i] <= maxTimeout)
  }
})()
;(function testTimeoutsAreIncremental() {
  const timeouts = retry.timeouts()
  let lastTimeout = timeouts[0]
  for (let i = 0; i < timeouts; i++) {
    assert.ok(timeouts[i] > lastTimeout)
    lastTimeout = timeouts[i]
  }
})()
;(function testTimeoutsAreIncrementalForFactorsLessThanOne() {
  const timeouts = retry.timeouts({
    retries: 3,
    factor: 0.5,
  })

  const expected = [250, 500, 1000]
  assert.deepEqual(expected, timeouts)
})()
;(function testRetries() {
  const timeouts = retry.timeouts({ retries: 2 })
  assert.strictEqual(timeouts.length, 2)
})()
