const authentication = require('./authentication');
const extractTables = require('./creates/extractTables');

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,
  authentication,
  creates: {
    [extractTables.key]: extractTables
  }
};
