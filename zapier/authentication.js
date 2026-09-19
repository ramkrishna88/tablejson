module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'api_key',
      label: 'API Key',
      required: true,
      type: 'password',
      helpText: 'Your TableJSON API key. Send as X-API-Key.'
    }
  ],
  connectionLabel: 'TableJSON',
  test: {
    url: 'https://tablejson.com/v1/health',
    method: 'GET'
  }
};
