const RetryOperation = require("./retry_operation")

exports.operation = function (options) {
  const timeouts = exports.timeouts(options)
  return new RetryOperation(timeouts, {
    forever: options && (options.forever || options.retries === Infinity),
    unref: options && options.unref,
    maxRetryTime: options && options.maxRetryTime,
    onNewTimeout: options && options.onNewTimeout,
  })
}

exports.timeouts = function (options) {
  if (options instanceof Array) {
    return [].concat(options)
  }

  const opts = {
    retries: 10,
    factor: 2,
    minTimeout: 1 * 1000,
    maxTimeout: Infinity,
    randomize: false,
    ...options,
  }

  if (opts.minTimeout > opts.maxTimeout) {
    throw new Error("minTimeout is greater than maxTimeout")
  }

  const timeouts = []
  let i
  for (i = 0; i < opts.retries; i++) {
    timeouts.push(this.createTimeout(i, opts))
  }

  if (options && options.forever && !timeouts.length) {
    timeouts.push(this.createTimeout(i, opts))
  }

  // sort the array numerically ascending
  timeouts.sort((a, b) => a - b)

  return timeouts
}

exports.createTimeout = function (attempt, opts) {
  const random = opts.randomize ? Math.random() + 1 : 1

  let timeout = Math.round(
    random * Math.max(opts.minTimeout, 1) * opts.factor ** attempt
  )
  timeout = Math.min(timeout, opts.maxTimeout)

  return timeout
}

exports.wrap = function (obj, options, methods) {
  if (options instanceof Array) {
    methods = options
    options = null
  }

  if (!methods) {
    methods = []
    for (const key in obj) {
      if (typeof obj[key] === "function") {
        methods.push(key)
      }
    }
  }

  for (let i = 0; i < methods.length; i++) {
    const method = methods[i]
    const original = obj[method]

    obj[method] = function retryWrapper(...allargs) {
      const [origin] = allargs
      const op = exports.operation(options)
      const args = Array.prototype.slice.call(allargs, 1)
      const callback = args.pop()

      args.push(function (err) {
        if (op.retry(err)) {
          return
        }
        if (err) {
          allargs[0] = op.mainError()
        }
        callback.apply(this, allargs)
      })

      op.attempt(() => {
        origin.apply(obj, args)
      })
    }.bind(obj, original)
    obj[method].options = options
  }
}
