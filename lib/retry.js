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

  // Fail fast on non-numeric timeout options: they would otherwise produce
  // NaN timeouts that silently break setTimeout.
  for (const key of ["factor", "minTimeout", "maxTimeout"]) {
    const value = opts[key]
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`${key} must be a number`)
    }
  }

  if (opts.minTimeout > opts.maxTimeout) {
    throw new Error("minTimeout is greater than maxTimeout")
  }

  const timeouts = []

  // `retries` may be null/undefined (default) or Infinity (forever mode, as
  // set by exports.operation) — both generate a finite base set of timeouts
  // that forever mode then cycles through.
  let { retries } = opts
  if (retries === null || retries === undefined || retries === Infinity) {
    retries = 10
  } else if (
    typeof retries !== "number" ||
    Number.isNaN(retries) ||
    retries < 0
  ) {
    throw new Error(
      "retries must be a non-negative number, Infinity, or null/undefined"
    )
  }

  for (let i = 0; i < retries; i++) {
    timeouts.push(exports.createTimeout(i, opts))
  }

  if (options && options.forever && !timeouts.length) {
    timeouts.push(exports.createTimeout(0, opts))
  }

  // sort the array numerically ascending
  timeouts.sort((a, b) => a - b)

  return timeouts
}

exports.createTimeout = function (attempt, opts) {
  const random = opts.randomize ? Math.random() + 1 : 1
  const baseTimeout = Math.max(opts.minTimeout, 1)
  const exponential = Math.max(opts.factor ** attempt, 0)

  let timeout = Math.round(random * baseTimeout * exponential)
  timeout = Math.min(timeout, opts.maxTimeout)

  return Math.max(timeout, 1)
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
