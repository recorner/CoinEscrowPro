function createInitialSession() {
  return {
    user: null,
    currentDeal: null,
    awaitingInput: null,
    language: 'en',
    step: null,
    data: {},
    lastActivity: new Date(),
  };
}

function sessionMiddleware() {
  return async (ctx, next) => {
    // Update last activity
    ctx.session.lastActivity = new Date();
    
    // Initialize user session if not exists
    if (!ctx.session.user && ctx.from) {
      ctx.session.user = {
        id: ctx.from.id,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        languageCode: ctx.from.language_code,
      };
    }
    
    await next();
  };
}

module.exports = {
  createInitialSession,
  sessionMiddleware,
};
