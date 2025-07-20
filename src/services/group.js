const { logger } = require('../utils/logger');

class GroupService {
  constructor(bot) {
    this.bot = bot;
  }

  /**
   * Create a new group for an escrow deal
   * @param {string} dealId - The deal ID
   * @param {string} buyerUsername - Buyer's username
   * @param {string} sellerUsername - Seller's username
   * @param {string} crypto - Cryptocurrency type (BTC/LTC)
   * @returns {Object} Group information
   */
  async createDealGroup(dealId, buyerUsername, sellerUsername, crypto) {
    try {
      const groupTitle = `🔒 Escrow Deal #${dealId.slice(-6)} - ${crypto}`;
      const groupDescription = `Secure escrow deal between @${buyerUsername} and @${sellerUsername}`;

      // Create the group
      const group = await this.bot.api.createGroup(groupTitle, []);
      const chatId = group.id;

      logger.info(`Created escrow group: ${groupTitle} (ID: ${chatId})`);

      // Set group description
      try {
        await this.bot.api.setChatDescription(chatId, groupDescription);
      } catch (error) {
        logger.warn('Failed to set group description:', error.message);
      }

      // Set group photo (optional - you can add a default escrow logo)
      // await this.bot.api.setChatPhoto(chatId, photoFile);

      return {
        chatId,
        title: groupTitle,
        inviteLink: null, // Will generate later
        success: true
      };

    } catch (error) {
      logger.error('Error creating deal group:', error);
      throw error;
    }
  }

  /**
   * Generate an invite link for the group
   * @param {string} chatId - Group chat ID
   * @returns {string} Invite link
   */
  async generateInviteLink(chatId) {
    try {
      const result = await this.bot.api.createChatInviteLink(chatId, {
        expire_date: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
        member_limit: 2 // Only allow 2 additional members (buyer + seller)
      });
      
      return result.invite_link;
    } catch (error) {
      logger.error('Error generating invite link:', error);
      throw error;
    }
  }

  /**
   * Add user to the group by user ID
   * @param {string} chatId - Group chat ID
   * @param {string} userId - User ID to add
   */
  async addUserToGroup(chatId, userId) {
    try {
      await this.bot.api.addChatMember(chatId, userId);
      logger.info(`Added user ${userId} to group ${chatId}`);
    } catch (error) {
      logger.error(`Error adding user ${userId} to group ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Send welcome message to the deal group
   * @param {string} chatId - Group chat ID
   * @param {Object} dealInfo - Deal information
   */
  async sendWelcomeMessage(chatId, dealInfo) {
    const welcomeText = `
🔒 **ESCROW DEAL GROUP**

**Deal ID:** \`${dealInfo.id}\`
**Cryptocurrency:** ${dealInfo.crypto}
**Participants:** @${dealInfo.buyerUsername} ↔️ @${dealInfo.sellerUsername}

📋 **Next Steps:**
1. Both parties confirm participation
2. Deal terms will be set
3. Escrow address will be provided
4. Payment monitoring begins

⚠️ **Important:** Only communicate about this deal in this group. Do not share sensitive information elsewhere.

Type /help for available commands.
    `;

    try {
      await this.bot.api.sendMessage(chatId, welcomeText, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('Error sending welcome message:', error);
    }
  }

  /**
   * Set group permissions for escrow deal
   * @param {string} chatId - Group chat ID
   */
  async setGroupPermissions(chatId) {
    try {
      // Restrict group permissions for security
      await this.bot.api.setChatPermissions(chatId, {
        can_send_messages: true,
        can_send_media_messages: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false
      });

      logger.info(`Set security permissions for group ${chatId}`);
    } catch (error) {
      logger.error('Error setting group permissions:', error);
    }
  }

  /**
   * Send invite to user via private message
   * @param {string} userId - User ID to send invite to
   * @param {string} inviteLink - Group invite link
   * @param {Object} dealInfo - Deal information
   */
  async sendInviteMessage(userId, inviteLink, dealInfo) {
    const inviteText = `
🤝 **ESCROW DEAL INVITATION**

You've been invited to join an escrow deal:

**Deal ID:** \`${dealInfo.id}\`
**Cryptocurrency:** ${dealInfo.crypto}
**Initiator:** @${dealInfo.initiatorUsername}

**🔗 Join Deal Group:**
${inviteLink}

⏰ **This invite expires in 24 hours**

By joining, you agree to participate in this secure escrow transaction. All communications should happen in the deal group.
    `;

    try {
      await this.bot.api.sendMessage(userId, inviteText, {
        parse_mode: 'Markdown'
      });
      
      logger.info(`Sent invite to user ${userId} for deal ${dealInfo.id}`);
    } catch (error) {
      logger.error(`Error sending invite to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user exists and can receive messages
   * @param {string} username - Username to check (without @)
   * @returns {Object} User information or null
   */
  async getUserByUsername(username) {
    try {
      // Note: Telegram Bot API doesn't have a direct way to get user by username
      // This is a limitation. We'll need to handle this differently.
      // Alternative approach: Ask user to forward a message or start the bot first
      
      return null; // Will implement alternative approach
    } catch (error) {
      logger.error(`Error getting user by username ${username}:`, error);
      return null;
    }
  }
}

module.exports = { GroupService };
