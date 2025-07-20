# 💰 CoinEscrowPro Payment & Deal Process Guide

## Table of Contents
1. [Overview](#overview)
2. [Deal Lifecycle](#deal-lifecycle)
3. [Payment Processing](#payment-processing)
4. [Fee Structure](#fee-structure)
5. [Security & Encryption](#security--encryption)
6. [Step-by-Step Deal Process](#step-by-step-deal-process)
7. [Technical Implementation](#technical-implementation)
8. [Error Handling](#error-handling)
9. [Admin Functions](#admin-functions)
10. [Troubleshooting](#troubleshooting)

---

## Overview

CoinEscrowPro provides a secure, automated escrow service for cryptocurrency transactions between buyers and sellers. The system supports Bitcoin (BTC) and Litecoin (LTC) with automatic payment detection, secure fund storage, and transparent fee collection.

### Key Features
- 🔒 **Secure Escrow**: Automated address generation with encrypted private key storage
- 💰 **Multi-Currency**: Bitcoin (BTC) and Litecoin (LTC) support
- 🤖 **Automated Monitoring**: Real-time blockchain payment detection
- 💸 **Transparent Fees**: Clear fee structure with automatic deduction
- 👥 **Private Groups**: Dedicated Telegram groups for each deal
- 🛡️ **Dispute Resolution**: Admin intervention for conflicts
- 📊 **Complete Audit Trail**: Full transaction and action logging

---

## Deal Lifecycle

### Deal States
1. **PENDING** - Deal created, waiting for participants to set addresses
2. **WAITING_PAYMENT** - Escrow address generated, waiting for buyer payment
3. **FUNDED** - Payment confirmed, ready for release
4. **COMPLETED** - Funds released to seller successfully
5. **CANCELLED** - Deal cancelled before funding
6. **DISPUTED** - Under admin review due to conflict
7. **EXPIRED** - Deal timeout reached without payment

### Typical Flow
```
Deal Creation → Address Setup → Escrow Generation → Payment → Confirmation → Release → Completion
```

---

## Payment Processing

### 1. Escrow Address Generation
- **Secure Key Generation**: Private keys generated using cryptographically secure methods
- **Address Types**: 
  - Bitcoin: Bech32 format (`bc1q...`)
  - Litecoin: Bech32 format (`ltc1q...`)
- **Private Key Encryption**: All private keys encrypted using AES-256-CBC before storage
- **Unique Per Deal**: Each deal gets a unique escrow address

### 2. Payment Detection
- **Blockchain Monitoring**: Continuous scanning for incoming transactions
- **Confirmation Requirements**:
  - Bitcoin: 1 confirmation (configurable)
  - Litecoin: 1 confirmation (configurable)
- **Balance Verification**: Exact amount matching with tolerance for network fees
- **Real-time Updates**: Participants notified immediately upon payment detection

### 3. Fund Security
- **Cold Storage Principle**: Private keys encrypted and stored securely
- **No Hot Wallets**: Funds remain in escrow addresses until release
- **Multi-layer Encryption**: Private keys protected by master encryption key
- **Audit Trail**: Complete logging of all fund movements

---

## Fee Structure

### Standard Fees
- **Small Deals**: $5 flat fee for deals under $100 USD equivalent
- **Large Deals**: 5% of total amount for deals $100 USD and above

### Fee Calculation Examples
```javascript
Deal Amount: $50 USD in BTC
Platform Fee: $5 USD in BTC (10% effective rate)
Seller Receives: $45 USD in BTC

Deal Amount: $150 USD in BTC  
Platform Fee: $7.50 USD in BTC (5% rate)
Seller Receives: $142.50 USD in BTC

Deal Amount: $1000 USD in LTC
Platform Fee: $50 USD in LTC (5% rate)  
Seller Receives: $950 USD in LTC
```

### Fee Distribution
- **Automatic Deduction**: Fees automatically calculated and deducted during release
- **Platform Collection**: Fees sent to configured platform payout wallets
- **Transparent Process**: All fee calculations shown to participants before confirmation
- **Referral Sharing**: Portion of fees shared with referring groups (if applicable)

---

## Security & Encryption

### Private Key Management
```javascript
// Key Generation Process
1. Generate 256-bit cryptographically secure private key
2. Encrypt using AES-256-CBC with master key
3. Store encrypted key in database
4. Original key immediately destroyed from memory

// Encryption Specification
Algorithm: AES-256-CBC
Key Derivation: PBKDF2 with salt
IV: Random 16-byte initialization vector
Storage Format: "IV:EncryptedData" (hex encoded)
```

### Database Security
- **Encrypted Storage**: All sensitive data encrypted at rest
- **Access Control**: Private keys only accessible to authorized processes
- **Audit Logging**: Complete trail of all access and modifications
- **Backup Security**: Encrypted backups with separate key management

### Network Security
- **HTTPS Only**: All API communications encrypted in transit
- **Webhook Verification**: Signed webhooks with secret verification
- **Rate Limiting**: Protection against abuse and DoS attacks
- **Input Validation**: Comprehensive sanitization of all inputs

---

## Step-by-Step Deal Process

### For Buyers

#### 1. Deal Initiation
```
/start → "🤝 Start Deal" → Enter seller username
```
- Bot creates private Telegram group
- Adds both buyer and seller
- Generates unique deal ID

#### 2. Setup Phase
```
/set btc          # Choose cryptocurrency
/amount 0.5       # Set deal amount
/setwallet bc1q... # Set your receiving address (for refunds)
```

#### 3. Escrow Generation
- Once seller also sets their address, escrow is auto-generated
- QR code provided for easy payment
- Deal moves to WAITING_PAYMENT status

#### 4. Payment
```
Send exact amount to escrow address
Example: 0.5 BTC to bc1q6ac4a16944156aad0bff73b783ef08159a9f3f9
```
- **Important**: Send from personal wallet, not exchange
- **Timing**: Complete within timeout period (default 60 minutes)
- **Amount**: Send exact amount specified

#### 5. Confirmation
- Bot automatically detects payment
- Deal status changes to FUNDED
- Seller notified to deliver goods/services

#### 6. Release
```
/release    # Release funds to seller
```
- Confirm you received goods/services
- Fees automatically deducted
- Seller receives net amount

### For Sellers

#### 1. Join Deal
- Receive invitation to deal group
- Verify deal details and counterparty

#### 2. Setup Phase  
```
/set btc          # Confirm cryptocurrency
/setwallet bc1q... # Set your receiving address
```

#### 3. Wait for Payment
- Monitor deal status
- Prepare goods/services for delivery

#### 4. Delivery
- Once deal shows FUNDED status
- Deliver agreed goods/services
- Provide proof of delivery if applicable

#### 5. Receive Payment
- Buyer releases funds using `/release`
- Automatic transfer to your wallet
- Deal marked as COMPLETED

---

## Technical Implementation

### Database Schema

#### Deals Table
```sql
-- Core deal information
dealNumber: VARCHAR(20) UNIQUE    -- Human-readable ID (e.g., "CEP-2025-001")
buyerId: INTEGER                  -- Foreign key to users table
sellerId: INTEGER                 -- Foreign key to users table
amount: DECIMAL(18,8)             -- Deal amount in cryptocurrency
cryptocurrency: VARCHAR(10)       -- BTC, LTC, etc.
status: ENUM                      -- PENDING, WAITING_PAYMENT, FUNDED, etc.

-- Escrow details
escrowAddress: VARCHAR(100)       -- Generated escrow address
escrowPrivateKey: TEXT           -- Encrypted private key
expiresAt: TIMESTAMP             -- Payment timeout
confirmationsReq: INTEGER        -- Required blockchain confirmations
confirmationsRec: INTEGER        -- Received confirmations

-- Financial details
feeAmount: DECIMAL(18,8)         -- Platform fee amount
feePercentage: DECIMAL(5,2)      -- Fee percentage applied
releasedAt: TIMESTAMP            -- When funds were released

-- Status tracking
isDisputed: BOOLEAN              -- Dispute flag
disputeReason: TEXT              -- Dispute details
cancelReason: TEXT               -- Cancellation reason
```

#### Transactions Table
```sql
-- Transaction records
id: VARCHAR(36) PRIMARY KEY       -- UUID
dealId: INTEGER                   -- Foreign key to deals
type: ENUM                        -- DEPOSIT, RELEASE, FEE, REFUND
fromAddress: VARCHAR(100)         -- Source address
toAddress: VARCHAR(100)           -- Destination address
amount: DECIMAL(18,8)             -- Transaction amount
cryptocurrency: VARCHAR(10)       -- BTC, LTC, etc.
txHash: VARCHAR(100)             -- Blockchain transaction hash
status: ENUM                      -- PENDING, CONFIRMED, FAILED
confirmations: INTEGER            -- Blockchain confirmations
feeAmount: DECIMAL(18,8)         -- Network fee paid
createdAt: TIMESTAMP             -- Transaction creation time
```

### API Integration

#### Getblock.io Configuration
```javascript
// Admin-configurable endpoints
BTC Endpoint: https://go.getblock.io/{api_key}
LTC Endpoint: https://go.getblock.io/{api_key}
BTC WebSocket: wss://btc.getblock.io/{api_key}/websocket
LTC WebSocket: wss://ltc.getblock.io/{api_key}/websocket

// Balance checking
GET /v1/btc/mainnet/address/{address}/balance
GET /v1/ltc/mainnet/address/{address}/balance

// Transaction broadcasting
POST /v1/btc/mainnet/tx/send
POST /v1/ltc/mainnet/tx/send
```

#### Wallet Service Interface
```javascript
// Address generation
static async generateEscrowAddress(cryptocurrency)
// Returns: { success, address, privateKey, encryptedPrivateKey }

// Balance checking  
static async getAddressBalance(address, cryptocurrency)
// Returns: { success, balance, unconfirmed, confirmations }

// Transaction sending
static async sendTransaction(params)
// Params: { fromAddress, toAddress, amount, cryptocurrency, privateKey }
// Returns: { success, txHash, fee, error }
```

### Monitoring System

#### Payment Detection
```javascript
// Scheduler runs every 30 seconds
async function checkPendingPayments() {
  // Get all deals in WAITING_PAYMENT status
  const pendingDeals = await prisma.deal.findMany({
    where: { status: 'WAITING_PAYMENT' }
  });
  
  // Check each escrow address for payments
  for (const deal of pendingDeals) {
    const paymentResult = await EscrowService.checkPayment(deal.id);
    
    if (paymentResult.funded) {
      // Payment confirmed - update deal status
      await markDealAsFunded(deal.id, paymentResult.amount);
      // Notify participants
      await notifyPaymentConfirmed(deal);
    }
  }
}
```

#### Timeout Management
```javascript
// Check for expired deals
async function checkExpiredDeals() {
  const expiredDeals = await prisma.deal.findMany({
    where: {
      status: 'WAITING_PAYMENT',
      expiresAt: { lt: new Date() }
    }
  });
  
  for (const deal of expiredDeals) {
    await EscrowService.expireDeal(deal.id);
    await notifyDealExpired(deal);
  }
}
```

---

## Error Handling

### Common Issues & Solutions

#### Payment Not Detected
**Symptoms**: Deal stuck in WAITING_PAYMENT despite sending funds
**Causes**:
- Sent from exchange wallet (not supported)
- Incorrect amount sent
- Network congestion delaying confirmations
- Wrong address used

**Solutions**:
```bash
# Check transaction manually
/balance                    # View current escrow status
/txid <transaction_hash>   # Submit transaction hash manually

# Admin intervention
/dispute                   # Open dispute for manual review
```

#### Release Failures
**Symptoms**: `/release` command fails or shows error
**Causes**:
- Seller wallet address invalid
- Insufficient escrow balance
- Network connectivity issues
- Private key decryption failure

**Solutions**:
```bash
# Verify setup
/balance                   # Check escrow status
/setwallet <new_address>   # Update seller address

# Admin assistance
/dispute                   # Request manual release
```

#### Address Generation Failures
**Symptoms**: No escrow address generated after both parties set wallets
**Causes**:
- Getblock.io API issues
- Invalid wallet addresses provided
- System configuration problems

**Solutions**:
```bash
# Retry setup
/setwallet <address>       # Re-submit wallet address
/set <crypto>              # Re-confirm cryptocurrency

# Manual intervention
Contact admin via /dispute
```

### Error Response Format
```javascript
// Standard error response
{
  success: false,
  error: "Human-readable error message",
  code: "ERROR_CODE",           // Machine-readable error type
  details: {                    // Additional error context
    dealId: "CEP-2025-001",
    address: "bc1q...",
    amount: 0.5
  }
}
```

---

## Admin Functions

### Configuration Management

#### Payout Wallet Setup
```bash
# Set platform payout addresses
/setpayout BTC bc1q8fwypfetn5mu994wpxh70ag9mtq54gaa9d44le
/setpayout LTC LMToh58PhRsHsSskrdYX9FoCN187hZdfod

# View current configuration
/listsettings
```

#### API Endpoint Management
```bash
# Configure Getblock.io endpoints
/setgetblock BTC https://go.getblock.io/e09a873de73f402b9ed2b55809977aa8
/setgetblock LTC https://go.getblock.io/0a50cc0961b044dd8a65246c3808872e

# Configure WebSocket endpoints
/setwebsocket BTC wss://btc.getblock.io/e09a873de73f402b9ed2b55809977aa8/websocket
/setwebsocket LTC wss://ltc.getblock.io/0a50cc0961b044dd8a65246c3808872e/websocket
```

#### System Initialization
```bash
# Initialize default settings
/initdefaults              # Set up default payout wallets and API endpoints

# View platform statistics
/platformstats             # Show total deals, volume, revenue
```

### Deal Management

#### Manual Intervention
```bash
# Force deal completion
/admin release <deal_id> <reason>

# Cancel problematic deals  
/admin cancel <deal_id> <reason>

# Modify deal parameters
/admin timeout <deal_id> <minutes>
/admin amount <deal_id> <new_amount>
```

#### Dispute Resolution
```bash
# View disputed deals
/admin disputes

# Resolve dispute in favor of buyer (refund)
/admin resolve <deal_id> buyer <reason>

# Resolve dispute in favor of seller (release)
/admin resolve <deal_id> seller <reason>

# Custom resolution (partial payments)
/admin custom <deal_id> <buyer_amount> <seller_amount>
```

### Financial Management

#### Fee Collection
```bash
# View fee collection statistics
/admin fees

# Manual fee collection from deals
/admin collect <deal_id>

# Update fee structure
/admin setfee <percentage> <flat_amount>
```

#### Revenue Tracking
```bash
# Total platform revenue
/admin revenue

# Revenue by cryptocurrency
/admin revenue BTC
/admin revenue LTC

# Revenue by time period
/admin revenue --month 2025-01
/admin revenue --week 2025-W03
```

---

## Troubleshooting

### For Users

#### Deal Not Progressing
1. **Check Status**: Use `/balance` to see current deal state
2. **Verify Addresses**: Ensure wallet addresses are correct
3. **Confirm Payment**: Check if payment was sent to correct address
4. **Contact Support**: Use `/dispute` if issue persists

#### Payment Issues
1. **Transaction Confirmation**: Check blockchain explorer for transaction status
2. **Amount Verification**: Ensure exact amount was sent (including network fees)
3. **Address Verification**: Double-check escrow address from bot message
4. **Timeout Check**: Verify payment was sent within timeout period

#### Release Problems
1. **Status Check**: Ensure deal shows FUNDED status
2. **Permission Verify**: Only buyer can release funds
3. **Seller Address**: Confirm seller has set valid receiving address
4. **Network Issues**: Try again if network connectivity problems

### For Administrators

#### System Monitoring
```bash
# Check system health
/admin health

# View active deals
/admin deals --status FUNDED
/admin deals --status WAITING_PAYMENT

# Monitor failed transactions
/admin failed-transactions

# Check API connectivity
/admin test-apis
```

#### Database Maintenance
```bash
# Clean up expired deals
/admin cleanup --expired

# Archive completed deals older than 30 days
/admin archive --days 30

# Backup sensitive data
/admin backup --encrypt

# Verify data integrity
/admin verify --private-keys
/admin verify --balances
```

#### Performance Optimization
```bash
# Check scheduler performance
/admin scheduler-stats

# Monitor API response times
/admin api-performance

# Database query optimization
/admin db-stats

# Memory usage monitoring
/admin memory-usage
```

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `DEAL_NOT_FOUND` | Deal ID doesn't exist | Verify deal number |
| `INSUFFICIENT_BALANCE` | Escrow balance too low | Check payment was received |
| `UNAUTHORIZED_USER` | User not part of deal | Ensure correct permissions |
| `INVALID_ADDRESS` | Wallet address format invalid | Provide valid crypto address |
| `PAYMENT_TIMEOUT` | Deal expired waiting for payment | Create new deal |
| `DUPLICATE_PAYMENT` | Payment already processed | Check deal status |
| `NETWORK_ERROR` | Blockchain API unavailable | Retry operation later |
| `ENCRYPTION_FAILED` | Private key encryption error | Contact system administrator |

---

## Best Practices

### For Buyers
1. **Verify Seller**: Check reputation and previous deal history
2. **Secure Wallet**: Use personal wallet, never exchange addresses
3. **Double-Check Amount**: Send exact amount specified in deal
4. **Quick Payment**: Send payment promptly to avoid timeout
5. **Communicate**: Keep seller informed of payment status
6. **Verify Delivery**: Confirm goods/services before releasing funds

### For Sellers
1. **Prompt Setup**: Set wallet address immediately after joining deal
2. **Monitor Status**: Check deal progress regularly
3. **Quick Delivery**: Provide goods/services promptly after funding
4. **Proof of Delivery**: Document delivery for dispute protection
5. **Communication**: Respond to buyer messages quickly
6. **Quality Service**: Maintain high standards for reputation

### For Administrators
1. **Regular Monitoring**: Check system health daily
2. **Backup Management**: Maintain encrypted backups
3. **Security Updates**: Keep all dependencies updated
4. **Performance Tuning**: Monitor and optimize database queries
5. **User Support**: Respond to disputes promptly
6. **Fee Management**: Review and adjust fees based on market conditions

---

## API Reference

### Core Endpoints

#### Deal Management
```javascript
// Create new deal
POST /api/deals
{
  "buyerTelegramId": "123456789",
  "sellerTelegramId": "987654321", 
  "amount": 0.5,
  "cryptocurrency": "BTC"
}

// Get deal status
GET /api/deals/{dealId}

// Update deal
PATCH /api/deals/{dealId}
{
  "amount": 0.75,
  "timeoutMinutes": 120
}
```

#### Payment Processing
```javascript
// Check payment status
GET /api/deals/{dealId}/payment

// Release funds
POST /api/deals/{dealId}/release
{
  "buyerTelegramId": "123456789"
}

// Get transaction history
GET /api/deals/{dealId}/transactions
```

#### Wallet Operations
```javascript
// Generate escrow address
POST /api/wallets/escrow
{
  "dealId": "cea1b2c3-d4e5-f6g7-h8i9-j0k1l2m3n4o5",
  "cryptocurrency": "BTC"
}

// Check address balance
GET /api/wallets/{address}/balance/{cryptocurrency}

// Send transaction
POST /api/wallets/send
{
  "fromAddress": "bc1q...",
  "toAddress": "bc1q...",
  "amount": 0.5,
  "cryptocurrency": "BTC",
  "privateKey": "encrypted_key"
}
```

---

## Conclusion

CoinEscrowPro provides a comprehensive, secure, and automated escrow solution for cryptocurrency transactions. The system handles the complete payment lifecycle from deal creation to fund release, with robust security measures, transparent fee structures, and comprehensive error handling.

Key advantages:
- ✅ **Fully Automated**: Minimal manual intervention required
- ✅ **Secure by Design**: Multiple layers of encryption and security
- ✅ **Transparent Fees**: Clear, predictable fee structure
- ✅ **Complete Audit Trail**: Full logging and tracking
- ✅ **Multi-Currency Support**: Bitcoin and Litecoin ready
- ✅ **Dispute Resolution**: Admin intervention available
- ✅ **Real-time Monitoring**: Instant payment detection
- ✅ **User-Friendly**: Simple Telegram bot interface

For technical support or additional features, contact the development team or create an issue in the project repository.

---

*Last Updated: January 20, 2025*
*Version: 2.0.0*
