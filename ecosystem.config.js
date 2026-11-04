module.exports = {
  apps: [{
    name: 'aabot',
    script: 'index.js',
    autorestart: true,
    restart_delay: 5000,
    max_restarts: 50,
  }],
};
