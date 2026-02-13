module.exports = {
  apps: [{
    name: 'dorami-backend',
    script: 'dist/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    
    // Environment variables
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    
    env_development: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    
    // Logging
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Performance
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10,
    
    // Monitoring
    autorestart: true,
    watch: false,
    
    // Graceful shutdown
    kill_timeout: 30000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // Cluster mode settings
    instance_var: 'INSTANCE_ID',
  }]
};
