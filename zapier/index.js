const authentication = require('./authentication');
const extractTables = require('./creates/extractTables');
const invoiceXlsx = require('./creates/invoiceXlsx');

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,
  authentication,
  creates: {
    [extractTables.key]: extractTables,
    [invoiceXlsx.key]: invoiceXlsx
  }
};
