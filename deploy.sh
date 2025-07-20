#!/bin/bash

# CoinEscrowPro Bot Deployment Script
# Usage: ./deploy.sh [environment]

set -e

ENVIRONMENT=${1:-development}
APP_NAME="coin-escrow-pro-bot"

echo "🚀 Deploying CoinEscrowPro Bot to $ENVIRONMENT environment..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed. Docker deployment will not be available."
    fi
    
    print_status "Dependencies check completed ✅"
}

# Setup environment variables
setup_environment() {
    print_status "Setting up environment variables..."
    
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            print_warning "Created .env file from .env.example. Please update it with your configuration."
        else
            print_error ".env.example file not found. Cannot create .env file."
            exit 1
        fi
    else
        print_status "Environment file already exists ✅"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm ci
    print_status "Dependencies installed ✅"
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    # Generate Prisma client
    npx prisma generate
    
    # Push database schema
    if [ "$ENVIRONMENT" = "production" ]; then
        print_warning "Skipping database push in production. Run 'npx prisma db push' manually."
    else
        npx prisma db push
        print_status "Database schema applied ✅"
    fi
    
    # Seed database
    if [ -f "prisma/seed.js" ]; then
        npm run db:seed
        print_status "Database seeded ✅"
    fi
}

# Create required directories
create_directories() {
    print_status "Creating required directories..."
    mkdir -p logs
    mkdir -p data
    print_status "Directories created ✅"
}

# Validate configuration
validate_config() {
    print_status "Validating configuration..."
    
    if [ ! -f .env ]; then
        print_error ".env file not found. Please create it first."
        exit 1
    fi
    
    # Check required environment variables
    source .env
    
    if [ -z "$BOT_TOKEN" ]; then
        print_error "BOT_TOKEN is not set in .env file."
        exit 1
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL is not set in .env file."
        exit 1
    fi
    
    print_status "Configuration validated ✅"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        print_warning "Skipping tests in production deployment."
        return
    fi
    
    # Check if test files exist
    if [ -d "tests" ] || ls **/*.test.js 1> /dev/null 2>&1; then
        npm test
        print_status "Tests passed ✅"
    else
        print_warning "No tests found, skipping test execution."
    fi
}

# Build application
build_application() {
    print_status "Building application..."
    
    # Lint code
    npm run lint || print_warning "Linting warnings detected"
    
    # Format code
    npm run format || print_warning "Code formatting applied"
    
    print_status "Application built ✅"
}

# Start application
start_application() {
    print_status "Starting application..."
    
    case $ENVIRONMENT in
        "development")
            print_status "Starting in development mode..."
            npm run dev
            ;;
        "production")
            print_status "Starting in production mode..."
            
            # Check if PM2 is installed
            if command -v pm2 &> /dev/null; then
                pm2 start ecosystem.config.js
                pm2 save
                print_status "Application started with PM2 ✅"
            else
                print_warning "PM2 not found. Starting with npm..."
                npm start
            fi
            ;;
        "docker")
            print_status "Starting with Docker..."
            docker-compose up -d
            print_status "Application started with Docker ✅"
            ;;
        *)
            print_error "Unknown environment: $ENVIRONMENT"
            print_status "Available environments: development, production, docker"
            exit 1
            ;;
    esac
}

# Health check
health_check() {
    print_status "Performing health check..."
    
    if [ "$ENVIRONMENT" = "docker" ]; then
        sleep 10 # Wait for container to start
        docker-compose exec bot node healthcheck.js
    else
        node healthcheck.js
    fi
    
    print_status "Health check passed ✅"
}

# Deployment summary
deployment_summary() {
    print_status "🎉 Deployment completed successfully!"
    
    echo "
📋 Deployment Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Environment: $ENVIRONMENT
Application: $APP_NAME
Status: ✅ Running

📊 Next Steps:
"
    
    case $ENVIRONMENT in
        "development")
            echo "• Check logs with: npm run logs or tail -f logs/combined.log"
            echo "• Bot is running with hot reload enabled"
            echo "• Database studio: npm run db:studio"
            ;;
        "production")
            echo "• Check PM2 status: pm2 status"
            echo "• View logs: pm2 logs $APP_NAME"
            echo "• Restart app: pm2 restart $APP_NAME"
            echo "• Setup monitoring and alerts"
            ;;
        "docker")
            echo "• Check containers: docker-compose ps"
            echo "• View logs: docker-compose logs -f"
            echo "• Stop services: docker-compose down"
            ;;
    esac
    
    echo "
🔧 Management Commands:
• Health check: node healthcheck.js
• Database studio: npx prisma studio
• View database: npx prisma db push --preview-feature

💡 Important:
• Make sure to set up webhook URL in production
• Configure blockchain API keys properly
• Set up monitoring and backup systems
• Review security settings

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"
}

# Cleanup function for graceful exit
cleanup() {
    print_warning "Deployment interrupted. Cleaning up..."
    exit 1
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Main deployment flow
main() {
    print_status "Starting CoinEscrowPro Bot deployment..."
    print_status "Environment: $ENVIRONMENT"
    
    check_dependencies
    setup_environment
    install_dependencies
    create_directories
    validate_config
    setup_database
    run_tests
    build_application
    
    if [ "$1" != "--build-only" ]; then
        start_application
        sleep 5 # Wait for application to start
        health_check
    fi
    
    deployment_summary
}

# Handle command line arguments
case "$1" in
    "--help"|"-h")
        echo "CoinEscrowPro Bot Deployment Script"
        echo ""
        echo "Usage: $0 [environment] [options]"
        echo ""
        echo "Environments:"
        echo "  development  - Start with nodemon for development"
        echo "  production   - Start with PM2 for production"
        echo "  docker       - Start with Docker Compose"
        echo ""
        echo "Options:"
        echo "  --build-only - Only build, don't start the application"
        echo "  --help, -h   - Show this help message"
        exit 0
        ;;
    "--build-only")
        main --build-only
        ;;
    *)
        main
        ;;
esac
