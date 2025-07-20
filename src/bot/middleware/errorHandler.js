const { logger } = require('../../utils/logger');
const { GrammyError, HttpError } = require('grammy');

function errorHandler(ctx, next) {
  return next().catch((error) => {
    logger.error('Bot error:', {
      error: error.message,
      stack: error.stack,
      update: ctx.update,
      user: ctx.from,
    });

    // Handle different types of errors
    if (error instanceof GrammyError) {
      if (error.error_code === 403) {
        // Bot was blocked by user
        logger.info(`Bot blocked by user ${ctx.from?.id}`);
        return;
      }
      
      if (error.error_code === 400 && error.description.includes('message is not modified')) {
        // Message edit with same content - ignore
        return;
      }
    }

    // Send user-friendly error message
    const errorMessage = getErrorMessage(error);
    
    try {
      ctx.reply(errorMessage);
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  });
}

function getErrorMessage(error) {
  // Map specific errors to user-friendly messages
  if (error instanceof GrammyError) {
    switch (error.error_code) {
      case 400:
        if (error.description.includes('chat not found')) {
          return '❌ Chat not found. Please make sure the group exists.';
        }
        if (error.description.includes('not enough rights')) {
          return '❌ I don\'t have enough permissions to perform this action.';
        }
        break;
      case 403:
        return '❌ I don\'t have permission to send messages to this chat.';
      case 429:
        return '⏰ Too many requests. Please try again later.';
    }
  }

  if (error instanceof HttpError) {
    return '🌐 Network error. Please try again in a moment.';
  }

  // Generic error message
  return '❌ An unexpected error occurred. Please try again or contact support if the problem persists.';
}

module.exports = { errorHandler };
