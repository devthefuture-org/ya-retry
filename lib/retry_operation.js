function RetryOperation(timeouts, options) {
  // Compatibility for the old (timeouts, retryForever) signature
  if (typeof options === "boolean") {
    options = { forever: options }
  }

  this._originalTimeouts = JSON.parse(JSON.stringify(timeouts))
  this._timeouts = timeouts
  this._options = options || {}
  this._maxRetryTime = (options && options.maxRetryTime) || Infinity
  this._fn = null
  this._errors = []
  this._attempts = 1
  this._operationTimeout = null
  this._operationTimeoutCb = null
  this._timeout = null
  this._operationStart = null
  this._timer = null

  if (this._options.forever) {
    this._cachedTimeouts = this._timeouts.slice(0)
  }
}
module.exports = RetryOperation

RetryOperation.prototype.reset = function () {
  this._attempts = 1
  this._timeouts = this._originalTimeouts.slice(0)
}

RetryOperation.prototype.stop = function () {
  if (this._timeout) {
    clearTimeout(this._timeout)
  }
  if (this._timer) {
    clearTimeout(this._timer)
  }

  this._timeouts = []
  this._cachedTimeouts = null
}

RetryOperation.prototype.retry = function (err) {
  if (this._timeout) {
    clearTimeout(this._timeout)
  }

  if (!err) {
    return false
  }
  const currentTime = new Date().getTime()
  if (err && currentTime - this._operationStart >= this._maxRetryTime) {
    this._errors.push(err)
    this._errors.unshift(new Error("RetryOperation timeout occurred"))
    return false
  }

  this._errors.push(err)

  let timeout = this._timeouts.shift()
  if (timeout === undefined) {
    if (this._cachedTimeouts) {
      // retry forever, only keep last error
      this._errors.splice(0, this._errors.length - 1)
      timeout = this._cachedTimeouts.slice(-1)
    } else {
      return false
    }
  }

  const self = this
  this._timer = setTimeout(() => {
    self._attempts++

    if (self._operationTimeoutCb) {
      self._timeout = setTimeout(() => {
        self._operationTimeoutCb(self._attempts)
      }, self._operationTimeout)

      if (self._options.unref) {
        self._timeout.unref()
      }
    }

    self._fn(self._attempts)
  }, timeout)

  if (this._options.unref) {
    this._timer.unref()
  }

  return true
}

RetryOperation.prototype.attempt = function (fn, timeoutOps) {
  this._fn = fn

  if (timeoutOps) {
    if (timeoutOps.timeout) {
      this._operationTimeout = timeoutOps.timeout
    }
    if (timeoutOps.cb) {
      this._operationTimeoutCb = timeoutOps.cb
    }
  }

  const self = this
  if (this._operationTimeoutCb) {
    this._timeout = setTimeout(() => {
      self._operationTimeoutCb()
    }, self._operationTimeout)
  }

  this._operationStart = new Date().getTime()

  this._fn(this._attempts)
}

RetryOperation.prototype.try = function (fn) {
  console.log("Using RetryOperation.try() is deprecated")
  this.attempt(fn)
}

RetryOperation.prototype.start = function (fn) {
  console.log("Using RetryOperation.start() is deprecated")
  this.attempt(fn)
}

RetryOperation.prototype.start = RetryOperation.prototype.try

RetryOperation.prototype.errors = function () {
  return this._errors
}

RetryOperation.prototype.attempts = function () {
  return this._attempts
}

RetryOperation.prototype.mainError = function () {
  if (this._errors.length === 0) {
    return null
  }

  const counts = {}
  let mainError = null
  let mainErrorCount = 0

  for (let i = 0; i < this._errors.length; i++) {
    const error = this._errors[i]
    const { message } = error
    const count = (counts[message] || 0) + 1

    counts[message] = count

    if (count >= mainErrorCount) {
      mainError = error
      mainErrorCount = count
    }
  }

  return mainError
}
