# CoinEscrowPro Bot Setup Guide

## 🚀 Quick Start

### Prerequisites

1. **Node.js 18+** - [Download here](https://nodejs.org/)
2. **PostgreSQL** - [Download here](https://www.postgresql.org/download/)
3. **Git** - [Download here](https://git-scm.com/)
4. **Telegram Bot Token** - Get from [@BotFather](https://t.me/BotFather)
5. **BlockCypher API Key** - Get from [BlockCypher](https://www.blockcypher.com/)

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd CoinEscrowProBot

# Make deployment script executable
chmod +x deploy.sh

# Run automated setup
./deploy.sh development
```

### 2. Manual Setup (Alternative)

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env  # or use your preferred editor

# Setup database
npm run db:push
npm run db:seed

# Start development server
npm run dev
```

## ⚙️ Configuration

### Environment Variables

Edit `.env` file with your configuration:

```env
# Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here
BOT_USERNAME=YourBotUsername

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/coin_escrow_pro"

# Blockchain APIs
BLOCKCYPHER_API_KEY=your_blockcypher_api_key
GETBLOCK_API_KEY=your_getblock_api_key

# Admin Settings
ADMIN_USER_IDS=123456789,987654321
SUPER_ADMIN_ID=123456789

# Security
ENCRYPTION_KEY=your_32_character_encryption_key_here
JWT_SECRET=your_jwt_secret_here

# Channels
VOUCH_CHANNEL_ID=-1001234567890
STATS_CHANNEL_ID=-1001234567891
```

### Database Setup

1. **Create PostgreSQL Database:**
```sql
CREATE DATABASE coin_escrow_pro;
CREATE USER escrow_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE coin_escrow_pro TO escrow_user;
```

2. **Apply Schema:**
```bash
npx prisma db push
```

3. **Seed Initial Data:**
```bash
npm run db:seed
```

### Telegram Bot Setup

1. **Create Bot with @BotFather:**
   - Send `/newbot` to @BotFather
   - Choose bot name and username
   - Save the token

2. **Configure Bot:**
   - Set bot description and about text
   - Add bot commands menu
   - Configure inline mode if needed

3. **Get Bot Token:**
   - Copy token to `BOT_TOKEN` in `.env`

### Blockchain API Setup

1. **BlockCypher (Primary):**
   - Sign up at [BlockCypher](https://www.blockcypher.com/)
   - Get API key from dashboard
   - Add to `BLOCKCYPHER_API_KEY` in `.env`

2. **GetBlock.io (Backup):**
   - Sign up at [GetBlock.io](https://getblock.io/)
   - Get API key
   - Add to `GETBLOCK_API_KEY` in `.env`

## 🐳 Docker Deployment

### Quick Docker Setup

```bash
# Build and start with Docker Compose
./deploy.sh docker
```

### Manual Docker Setup

```bash
# Build image
docker build -t coin-escrow-pro .

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Docker Environment

The Docker setup includes:
- PostgreSQL database
- Redis for session storage
- Bot application
- Automatic health checks
- Volume persistence

## 🏭 Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Deploy to production
./deploy.sh production

# Manage with PM2
pm2 status
pm2 logs coin-escrow-pro-bot
pm2 restart coin-escrow-pro-bot
```

### Using systemd

1. **Create systemd service:**
```bash
sudo nano /etc/systemd/system/coin-escrow-pro.service
```

2. **Service configuration:**
```ini
[Unit]
Description=CoinEscrowPro Telegram Bot
After=network.target

[Service]
Type=simple
User=nodeuser
WorkingDirectory=/path/to/CoinEscrowProBot
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

3. **Enable and start:**
```bash
sudo systemctl enable coin-escrow-pro
sudo systemctl start coin-escrow-pro
sudo systemctl status coin-escrow-pro
```

### Nginx Reverse Proxy (For Webhooks)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location /webhook {
        proxy_pass http://localhost:3000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=wallet
```

### Manual Testing

1. **Test Bot Commands:**
   - Send `/start` to your bot
   - Try creating a deal
   - Test wallet setting
   - Verify error handling

2. **Test Blockchain Integration:**
   - Generate test addresses
   - Check balance queries
   - Verify transaction monitoring

3. **Test Admin Functions:**
   - Access admin panel
   - Test broadcast functionality
   - Verify user management

## 🔧 Development

### Project Structure

```
src/
├── index.js              # Main entry point
├── bot/                  # Telegram bot logic
│   ├── handlers/         # Command handlers
│   ├── middleware/       # Bot middleware
│   └── keyboards/        # Inline keyboards
├── services/             # Business logic
│   ├── escrow/          # Escrow operations
│   ├── wallet/          # Wallet management
│   └── scheduler.js     # Background tasks
├── utils/               # Utility functions
└── database/            # Database operations
```

### Available Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with hot reload
npm run build      # Generate Prisma client
npm run db:push    # Apply database schema
npm run db:studio  # Open database studio
npm run db:seed    # Seed database with initial data
npm run lint       # Run ESLint
npm run format     # Format code with Prettier
npm test           # Run tests
```

### Database Management

```bash
# Reset database (DANGER!)
npx prisma db push --force-reset

# View database in browser
npx prisma studio

# Generate new migration
npx prisma migrate dev --name migration_name

# Deploy migrations to production
npx prisma migrate deploy
```

## 📊 Monitoring

### Health Checks

```bash
# Manual health check
node healthcheck.js

# Health check endpoint (if using webhooks)
curl http://localhost:3000/health
```

### Logs

```bash
# Application logs
tail -f logs/combined.log

# Error logs only
tail -f logs/error.log

# PM2 logs
pm2 logs coin-escrow-pro-bot

# Docker logs
docker-compose logs -f bot
```

### Metrics

The bot automatically tracks:
- Total users and deals
- Success rates
- Transaction volumes
- Error rates
- Response times

## 🔒 Security

### Security Checklist

- [ ] Environment variables properly set
- [ ] Database credentials secured
- [ ] API keys restricted and rotated
- [ ] Bot token kept secret
- [ ] HTTPS enabled for webhooks
- [ ] Input validation implemented
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Error messages don't leak sensitive data
- [ ] Database access restricted

### Backup Strategy

1. **Database Backups:**
```bash
# Daily backup
pg_dump coin_escrow_pro > backup_$(date +%Y%m%d).sql

# Automated backup script
echo "0 2 * * * pg_dump coin_escrow_pro > /backups/db_$(date +\%Y\%m\%d).sql" | crontab -
```

2. **Code Backups:**
   - Use Git for version control
   - Regular commits to remote repository
   - Tag releases

## 🆘 Troubleshooting

### Common Issues

1. **Bot not responding:**
   - Check bot token validity
   - Verify network connectivity
   - Check logs for errors

2. **Database connection failed:**
   - Verify PostgreSQL is running
   - Check connection string
   - Verify user permissions

3. **Blockchain API errors:**
   - Check API key validity
   - Verify API endpoint URLs
   - Check rate limits

4. **Payment not detected:**
   - Verify address generation
   - Check blockchain confirmations
   - Review transaction monitoring logs

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Verbose Prisma logs
DEBUG="prisma:*" npm run dev
```

### Support

- **Documentation:** Check README.md and code comments
- **Issues:** Open GitHub issue with details
- **Logs:** Include relevant log entries
- **Environment:** Specify Node.js version, OS, etc.

## 🚀 Going Live

### Pre-launch Checklist

- [ ] All tests passing
- [ ] Production environment configured
- [ ] Database optimized and backed up
- [ ] Monitoring and alerting set up
- [ ] SSL certificates configured
- [ ] Bot commands and descriptions set
- [ ] Admin accounts configured
- [ ] Emergency procedures documented

### Launch Steps

1. **Deploy to production server**
2. **Set up monitoring and alerts**
3. **Configure domain and SSL**
4. **Set webhook URL**
5. **Test all functionality**
6. **Announce to users**
7. **Monitor for issues**

### Post-launch

- Monitor performance metrics
- Watch for user feedback
- Plan feature updates
- Regular security reviews
- Scale infrastructure as needed

Good luck with your CoinEscrowPro bot! 🎉
