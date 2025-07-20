# CoinEscrowPro Bot

Production-grade Telegram bot for automated peer-to-peer crypto escrow transactions using BTC and LTC.

## 📚 Documentation

- **[📖 Complete Payment & Deal Process Guide](PAYMENT_PROCESS_GUIDE.md)** - Comprehensive guide covering the entire payment flow, technical implementation, and troubleshooting
- **[🏗️ Project Summary](PROJECT_SUMMARY.md)** - Development overview and technical architecture

## Features

- 🤝 Automated escrow deal management with secure private key storage
- 💰 BTC & LTC support via configurable Getblock.io endpoints  
- 👥 Private group creation for each deal with MTProto integration
- ⏱️ Real-time payment monitoring and automatic confirmations
- 🏆 Reputation system and vouch management
- 📊 Public stats and comprehensive analytics
- 💸 Tiered fee structure ($5 < $100, 5% > $100) with automatic collection
- 🛡️ Complete admin panel with settings management
- 🔐 AES-256-CBC encrypted private key storage and secure transaction handling

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

## Security Features

- **Private Key Encryption**: AES-256-CBC encryption for all escrow private keys
- **Master Key Management**: Configurable master encryption key via environment
- **Admin Settings Security**: Encrypted storage of API endpoints and secrets
- **Role-based Access Control**: Admin-only commands and configurations
- **Complete Audit Trail**: Full transaction and action logging
- **Rate Limiting**: Protection against abuse and DoS attacks
- **Input Validation**: Comprehensive sanitization of all inputs
- **Secure Communication**: HTTPS-only API calls and webhook verification

## Payment Process Overview

### For Buyers
1. Start deal → Set crypto & amount → Set wallet address
2. Wait for escrow generation → Send payment to escrow address  
3. Wait for confirmation → Release funds when satisfied

### For Sellers  
1. Join deal → Set wallet address → Wait for payment
2. Deliver goods/services → Wait for buyer release
3. Receive automatic payout (minus platform fees)

### Fee Structure
- **Small Deals**: $5 flat fee for deals under $100
- **Large Deals**: 5% of total amount for deals $100 and above
- **Automatic Collection**: Fees deducted during fund release
- **Transparent**: All fees shown before confirmation

**[📖 Read the Complete Payment Guide](PAYMENT_PROCESS_GUIDE.md)** for detailed process documentation.

## Admin Configuration

### Default Payout Wallets
- **BTC**: `bc1q8fwypfetn5mu994wpxh70ag9mtq54gaa9d44le`
- **LTC**: `LMToh58PhRsHsSskrdYX9FoCN187hZdfod`

### Admin Commands
- `/initdefaults` - Initialize default settings
- `/setgetblock <BTC|LTC> <endpoint>` - Configure Getblock.io endpoints
- `/setwebsocket <BTC|LTC> <websocket>` - Configure WebSocket endpoints  
- `/setpayout <BTC|LTC> <address>` - Set payout wallet addresses
- `/listsettings` - View all configurations
- `/platformstats` - View platform statistics

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
