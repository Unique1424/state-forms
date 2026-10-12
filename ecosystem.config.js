module.exports = {
  apps: [
    {
      name: 'state-forms-staging',
      script: 'server-staging.js',
      cwd: '/root/js/state-forms/state-forms',
      env: {
        NODE_ENV: 'staging'
      }
    }
  ]
};
