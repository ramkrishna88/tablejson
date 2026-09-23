module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'api_key',
      label: 'API Key',
      required: true,
      type: 'password',
      helpText:
        'Your TableJSON API key. Send as X-API-Key. Get a key from the [TableJSON homepage](https://tablejson.com/home).'
    }
  ],
  connectionLabel: '{{service}}',
  test: {
    url: 'https://tablejson.com/v1/health',
    method: 'GET'
  }
};
