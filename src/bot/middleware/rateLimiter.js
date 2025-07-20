const { logger } = require('../../utils/logger');

// Rate limiting configuration
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute

function rateLimiter(ctx, next) {
  const userId = ctx.from?.id;
  if (!userId) return next();

  const now = Date.now();
  const userLimit = rateLimits.get(userId) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };

  // Reset counter if window has passed
  if (now > userLimit.resetTime) {
    userLimit.count = 0;
    userLimit.resetTime = now + RATE_LIMIT_WINDOW;
  }

  // Check rate limit
  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    logger.warn(`Rate limit exceeded for user ${userId}`);
    return ctx.reply('⚠️ Too many requests. Please wait a moment before trying again.');
  }

  // Increment counter
  userLimit.count++;
  rateLimits.set(userId, userLimit);

  return next();
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, limit] of rateLimits.entries()) {
    if (now > limit.resetTime) {
      rateLimits.delete(userId);
    }
  }
}, RATE_LIMIT_WINDOW);

module.exports = { rateLimiter };
