const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { logger } = require('../utils/logger');

class MTProtoService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.apiId = process.env.TELEGRAM_API_ID;
    this.apiHash = process.env.TELEGRAM_API_HASH;
    this.session = process.env.TELEGRAM_SESSION || '';
    this.phoneNumber = process.env.TELEGRAM_PHONE;
  }

  /**
   * Initialize MTProto client
   */
  async initialize() {
    try {
      if (!this.apiId || !this.apiHash) {
        logger.error('Telegram API credentials not found in environment variables');
        return false;
      }

      const stringSession = new StringSession(this.session);
      
      this.client = new TelegramClient(stringSession, parseInt(this.apiId), this.apiHash);

      await this.client.start({
        phoneNumber: this.phoneNumber,
        password: async () => process.env.TELEGRAM_PASSWORD || '',
        phoneCode: async () => {
          logger.warn('Phone code required for MTProto authentication');
          return process.env.TELEGRAM_CODE || '';
        },
        onError: (err) => logger.error('MTProto auth error:', err),
      });

      this.isConnected = true;
      logger.info('✅ MTProto client connected successfully');
      return true;

    } catch (error) {
      logger.error('Failed to initialize MTProto client:', error);
      return false;
    }
  }

  /**
   * Create a new Telegram group/supergroup
   * @param {string} title - Group title
   * @param {Array} users - Array of user IDs
   * @returns {Object} Group information
   */
  async createGroup(title, users = []) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      // First create a channel (supergroup)
      const result = await this.client.invoke(
        new Api.channels.CreateChannel({
          title: title,
          about: 'Secure escrow deal group - CoinEscrowPro',
          megagroup: true, // This makes it a supergroup
        })
      );

      logger.debug('Create channel result:', result);

      if (!result.chats || result.chats.length === 0) {
        throw new Error('No chat returned from createChannel');
      }

      const chat = result.chats[0];
      const chatId = -1000000000000 - chat.id; // Correct supergroup format
      
      logger.info(`Created supergroup: ${title} (ID: ${chatId})`);

      return {
        success: true,
        chatId: chatId,
        title: title,
        accessHash: chat.accessHash,
        chat: chat,
      };

    } catch (error) {
      logger.error('Error creating group via MTProto:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Add users to a group
   * @param {string} chatId - Group chat ID
   * @param {Array} userObjects - Array of user objects
   * @param {Object} chat - Chat object from creation
   */
  async addUsersToGroup(chatId, userObjects, chat) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      for (const userObj of userObjects) {
        try {
          await this.client.invoke(
            new Api.channels.InviteToChannel({
              channel: chat,
              users: [userObj],
            })
          );
          
          logger.info(`Added user ${userObj.id || userObj.username || 'unknown'} to group ${chatId}`);
        } catch (error) {
          logger.error(`Failed to add user ${userObj.id || userObj.username || 'unknown'} to group:`, error.message);
        }
      }

    } catch (error) {
      logger.error('Error adding users to group:', error);
      throw error;
    }
  }

  /**
   * Add a single user to a channel using user object
   * @param {string} chatId - Channel chat ID
   * @param {Object} userObj - User object from getUserByUsername
   */
  async addUserToChannel(chatId, userObj) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      await this.client.invoke(
        new Api.channels.InviteToChannel({
          channel: chatId,
          users: [userObj],
        })
      );
      
      logger.info(`Added user ${userObj.username || userObj.id} to channel ${chatId}`);

    } catch (error) {
      logger.error(`Failed to add user to channel:`, error.message);
      throw error;
    }
  }

  /**
   * Get user by username
   * @param {string} username - Username without @
   * @returns {Object} User information
   */
  async getUserByUsername(username) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      const result = await this.client.invoke(
        new Api.contacts.ResolveUsername({
          username: username,
        })
      );

      if (result.users && result.users.length > 0) {
        const user = result.users[0];
        return {
          success: true,
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          userObj: user, // Include the full user object for API calls
        };
      }

      return {
        success: false,
        error: 'User not found',
      };

    } catch (error) {
      logger.error(`Error getting user by username ${username}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create invite link for a group
   * @param {string} chatId - Group chat ID
   * @param {Object} options - Invite link options
   * @returns {string} Invite link
   */
  async createInviteLink(chatId, options = {}) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      const result = await this.client.invoke(
        new Api.messages.ExportChatInvite({
          peer: chatId,
          expireDate: options.expireDate,
          usageLimit: options.usageLimit,
        })
      );

      return {
        success: true,
        inviteLink: result.link,
      };

    } catch (error) {
      logger.error('Error creating invite link:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send message to a chat or user
   * @param {string|number} peer - Chat ID or User ID
   * @param {string} message - Message text
   * @param {Object} options - Additional options
   */
  async sendMessage(peer, message, options = {}) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      await this.client.invoke(
        new Api.messages.SendMessage({
          peer: peer,
          message: message,
          randomId: Math.floor(Math.random() * 1000000),
          ...options,
        })
      );

      logger.info(`Message sent to ${peer}`);

    } catch (error) {
      logger.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Get current user info
   * @returns {Object} Current user information
   */
  async getMe() {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      return await this.client.getMe();
    } catch (error) {
      logger.error('Error getting current user:', error);
      throw error;
    }
  }

  /**
   * Create escrow group and add participants
   * @param {Object} dealInfo - Deal information
   * @returns {Object} Group creation result
   */
  async createEscrowGroup(dealInfo) {
    try {
      const { dealId, initiatorUsername, counterpartyUsername, crypto } = dealInfo;
      
      // Get user information
      const initiatorUser = await this.getUserByUsername(initiatorUsername);
      const counterpartyUser = await this.getUserByUsername(counterpartyUsername);

      if (!initiatorUser.success) {
        throw new Error(`Initiator user @${initiatorUsername} not found`);
      }

      if (!counterpartyUser.success) {
        throw new Error(`Counterparty user @${counterpartyUsername} not found`);
      }

      // Get bot information
      const botUsername = process.env.BOT_USERNAME || 'CoinEscrowPro';
      const botUser = await this.getUserByUsername(botUsername);
      
      if (!botUser.success) {
        throw new Error('Could not find bot user');
      }

      // Create group with only the bot initially
      const groupTitle = `Escrow Pro #${dealId}`;
      
      // Create group first (empty)
      const groupResult = await this.createGroup(groupTitle, []);

      if (!groupResult.success) {
        throw new Error(`Failed to create group: ${groupResult.error}`);
      }

      const chatId = groupResult.chatId;

      // Add ONLY the bot to the group first
      await this.addUsersToGroup(chatId, [botUser.userObj], groupResult.chat);
      logger.info(`Added bot @${botUsername} to group ${chatId}`);
      
      // Promote bot to admin immediately
      await this.promoteBotToAdmin(chatId, groupResult.chat, botUser.userObj);
      logger.info(`Promoted bot to admin in group ${chatId}`);

      // Create invite link
      const inviteResult = await this.createInviteLink(chatId, {
        expireDate: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
        usageLimit: 5,
      });

      // Leave the group immediately after bot setup
      try {
        await this.client.invoke(
          new Api.channels.LeaveChannel({
            channel: new Api.InputChannel({
              channelId: groupResult.chat.id,
              accessHash: groupResult.chat.accessHash,
            }),
          })
        );
        logger.info(`MTProto user (owner) left group ${chatId} - bot is now in control`);
      } catch (error) {
        logger.warn(`Could not leave group: ${error.message}`);
      }

      return {
        success: true,
        chatId: chatId,
        title: groupTitle,
        inviteLink: inviteResult.success ? inviteResult.inviteLink : null,
        participants: [initiatorUser, counterpartyUser],
        botAdded: true,
        ownerLeft: true,
        invitationSent: false, // Will be sent by bot instead
        counterpartyUserId: counterpartyUser.id,
        // Return deal info for bot to handle everything else
        dealInfo: {
          dealId,
          crypto,
          initiatorUsername,
          counterpartyUsername,
        },
        // Return user objects for bot to add them
        usersToAdd: [initiatorUser, counterpartyUser],
      };

    } catch (error) {
      logger.error('Error creating escrow group:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send invitation message to a user
   * @param {string} userId - User ID to send invitation to
   * @param {Object} dealInfo - Deal information
   */
  async sendInvitationToUser(userId, dealInfo) {
    try {
      const inviteMessage = `
🤝 ESCROW DEAL INVITATION

You've been invited to join an escrow deal:

Deal ID: ${dealInfo.dealId}
Cryptocurrency: ${dealInfo.crypto}
Initiator: @${dealInfo.initiatorUsername}

🔗 Join Deal Group:
${dealInfo.inviteLink}

⏰ This invite expires in 24 hours

By joining, you agree to participate in this secure escrow transaction. All communications should happen in the deal group.
      `;

      await this.sendMessage(userId, inviteMessage);
      logger.info(`Sent deal invitation to user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send invitation to user ${userId}:`, error);
      // Don't throw, we'll fall back to bot API
      return false;
    }
  }

  /**
   * Send invitation via Bot API as fallback
   * @param {Object} bot - Bot instance  
   * @param {string} userId - User ID
   * @param {Object} dealInfo - Deal information
   */
  static async sendInvitationViaBot(bot, userId, dealInfo) {
    try {
      const inviteMessage = `
🤝 *ESCROW DEAL INVITATION*

You've been invited to join an escrow deal:

*Deal ID:* \`${dealInfo.dealId}\`
*Cryptocurrency:* ${dealInfo.crypto}
*Initiator:* @${dealInfo.initiatorUsername}

*🔗 Join Deal Group:*
${dealInfo.inviteLink}

⏰ *This invite expires in 24 hours*

By joining, you agree to participate in this secure escrow transaction. All communications should happen in the deal group.
      `;

      await bot.api.sendMessage(userId, inviteMessage, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });
      
      logger.info(`Sent deal invitation via bot API to user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send invitation via bot API to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Leave a group (for the MTProto user account)
   * @param {string} chatId - Group chat ID
   * @param {Object} chat - Chat object with access hash
   */
  async leaveGroup(chatId, chat) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      await this.client.invoke(
        new Api.channels.LeaveChannel({
          channel: new Api.InputChannel({
            channelId: chat.id,
            accessHash: chat.accessHash,
          }),
        })
      );

      logger.info(`Left group ${chatId}`);

    } catch (error) {
      logger.error('Error leaving group:', error);
      throw error;
    }
  }

  /**
   * Promote bot to admin in the group
   * @param {string} chatId - Group chat ID
   * @param {Object} chat - Chat object with access hash
   * @param {Object} botUserObj - Bot user object
   */
  async promoteBotToAdmin(chatId, chat, botUserObj) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      // Promote bot to admin with necessary permissions
      await this.client.invoke(
        new Api.channels.EditAdmin({
          channel: new Api.InputChannel({
            channelId: chat.id,
            accessHash: chat.accessHash,
          }),
          userId: botUserObj,
          adminRights: new Api.ChatAdminRights({
            changeInfo: true,
            deleteMessages: true,
            banUsers: true,
            inviteUsers: true,
            pinMessages: true,
            addAdmins: false,
            manageCall: false,
            other: true,
          }),
          rank: 'Escrow Bot',
        })
      );

      logger.info(`Promoted bot ${botUserObj.id} to admin in group ${chatId}`);

    } catch (error) {
      logger.error('Error promoting bot to admin:', error);
      // Don't throw error, this is not critical
    }
  }

  /**
   * Promote user to admin in the group
   * @param {string} chatId - Group chat ID
   * @param {Object} chat - Chat object with access hash
   * @param {Object} userObj - User object to promote
   * @param {string} rank - Admin rank title
   */
  async promoteUserToAdmin(chatId, chat, userObj, rank = 'Admin') {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      // Promote user to admin with limited permissions
      await this.client.invoke(
        new Api.channels.EditAdmin({
          channel: new Api.InputChannel({
            channelId: chat.id,
            accessHash: chat.accessHash,
          }),
          userId: userObj,
          adminRights: new Api.ChatAdminRights({
            changeInfo: false,
            deleteMessages: true,
            banUsers: false,
            inviteUsers: true,
            pinMessages: true,
            addAdmins: false,
            manageCall: false,
            other: false,
          }),
          rank: rank,
        })
      );

      logger.info(`Promoted user ${userObj.id} to admin with rank "${rank}" in group ${chatId}`);

    } catch (error) {
      logger.error('Error promoting user to admin:', error);
      // Don't throw error, this is not critical
    }
  }

  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        await this.client.disconnect();
        this.isConnected = false;
        logger.info('MTProto client disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting MTProto client:', error);
    }
  }
}

module.exports = { MTProtoService };
