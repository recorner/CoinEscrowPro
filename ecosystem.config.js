module.exports = {
  apps: [{
    name: 'coin-escrow-pro-bot',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    // Restart strategies
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s',
    // Health check
    health_check_grace_period: 10000,
    health_check_fatal_exceptions: true,
  }]
};
