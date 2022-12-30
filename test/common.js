const common = module.exports
const path = require("path")

const rootDir = path.join(__dirname, "..")
common.dir = {
  lib: `${rootDir}/lib`,
}

common.assert = require("assert")
common.fake = require("fake")
