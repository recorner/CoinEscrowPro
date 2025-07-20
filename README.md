# CoinEscrowPro Bot

Production-grade Telegram bot for automated peer-to-peer crypto escrow transactions using BTC and LTC.

## Features

- 🤝 Automated escrow deal management
- 💰 BTC & LTC wallet integration via BlockCypher/GetBlock.io
- 👥 Private group creation for each deal
- ⏱️ Countdown timers and automatic confirmations
- 🏆 Reputation system and vouch management
- 📊 Public stats and analytics
- 💸 Referral and monetization system
- 🛡️ Admin controls and dispute resolution
- 🔐 Secure wallet and transaction handling

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL
- Docker (optional)
- Telegram Bot Token
- BlockCypher API Key

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd CoinEscrowProBot
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
npm run db:push
npm run db:seed
```

5. Start the bot:
```bash
npm run dev
```

### Docker Setup

```bash
npm run docker:build
npm run docker:run
```

## Project Structure

```
src/
├── index.js              # Main application entry
├── bot/                  # Telegram bot logic
│   ├── handlers/         # Command and callback handlers
│   ├── middleware/       # Bot middleware
│   └── keyboards/        # Inline keyboards
├── services/             # Business logic
│   ├── escrow/          # Escrow management
│   ├── wallet/          # Wallet operations
│   ├── payment/         # Payment processing
│   └── user/            # User management
├── utils/               # Utility functions
├── config/              # Configuration files
└── database/            # Database queries
```

## Commands

### User Commands
- `/start` - Welcome and main menu
- `/help` - Get help and support
- `/setwallet <address>` - Set wallet address
- `/wallet` - Show current wallet
- `/release` - Release escrow funds (buyer only)
- `/cancel` - Cancel active deal
- `/dispute` - Escalate to admin
- `/balance` - Show escrow status
- `/vouch` - Post success story
- `/whoami` - Show role in current deal

### Admin Commands
- `/admin` - Access admin panel
- `/botstats` - Show bot statistics
- `/broadcast <message>` - Send announcement
- `/registergroup` - Register group for referrals

## API Integration

### BlockCypher
Used for Bitcoin and Litecoin blockchain operations:
- Address generation
- Payment monitoring
- Transaction broadcasting

### GetBlock.io
Alternative blockchain API provider with similar functionality.

## Database Schema

The bot uses Prisma ORM with PostgreSQL for data persistence:
- Users and profiles
- Escrow deals and transactions
- Wallet addresses
- Referral tracking
- Audit logs

## Security Features

- Encrypted sensitive data
- Role-based access control
- Transaction audit trails
- Rate limiting
- Input validation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Open an issue on GitHub
- Contact: support@coinescrowpro.com
- Telegram: @CoinEscrowProSupport
