const { InlineKeyboard } = require('grammy');

class Keyboards {
  static mainMenu() {
    return new InlineKeyboard()
      .text('🆘 Help', 'help')
      .text('📖 Instructions', 'instructions')
      .row()
      .text('🤝 Start Deal', 'start_deal')
      .text('📊 Stats', 'stats')
      .row()
      .text('👤 Profile', 'profile')
      .text('🔗 Referral', 'referral');
  }

  static helpMenu() {
    return new InlineKeyboard()
      .text('📋 Commands', 'help_commands')
      .text('❓ FAQ', 'help_faq')
      .row()
      .text('📞 Contact Support', 'help_support')
      .text('🔙 Back', 'main_menu');
  }

  static dealActions(dealId, userRole) {
    const keyboard = new InlineKeyboard();
    
    if (userRole === 'buyer') {
      keyboard
        .text('💰 Release Funds', `release_${dealId}`)
        .text('⏰ Extend Time', `extend_${dealId}`)
        .row();
    }
    
    keyboard
      .text('📊 Deal Status', `status_${dealId}`)
      .text('🚫 Cancel', `cancel_${dealId}`)
      .row()
      .text('⚠️ Dispute', `dispute_${dealId}`)
      .text('📝 Report', `report_${dealId}`);
    
    return keyboard;
  }

  static cryptoSelection() {
    return new InlineKeyboard()
      .text('₿ Bitcoin (BTC)', 'crypto_btc')
      .text('🪙 Litecoin (LTC)', 'crypto_ltc')
      .row()
      .text('🔙 Back', 'main_menu');
  }

  static confirmAction(action, data) {
    return new InlineKeyboard()
      .text('✅ Confirm', `confirm_${action}_${data}`)
      .text('❌ Cancel', `cancel_${action}`);
  }

  static adminPanel() {
    return new InlineKeyboard()
      .text('📊 Dashboard', 'admin_dashboard')
      .text('👥 Users', 'admin_users')
      .row()
      .text('🤝 Deals', 'admin_deals')
      .text('⚠️ Reports', 'admin_reports')
      .row()
      .text('📢 Broadcast', 'admin_broadcast')
      .text('⚙️ Settings', 'admin_settings');
  }

  static dealSetup() {
    return new InlineKeyboard()
      .text('👤 Set Participants', 'setup_participants')
      .text('💰 Set Amount', 'setup_amount')
      .row()
      .text('⏰ Set Timeout', 'setup_timeout')
      .text('✅ Create Deal', 'create_deal')
      .row()
      .text('🔙 Back', 'main_menu');
  }

  static walletActions() {
    return new InlineKeyboard()
      .text('📝 Set Wallet', 'set_wallet')
      .text('👁️ View Wallet', 'view_wallet')
      .row()
      .text('✅ Verify Wallet', 'verify_wallet')
      .text('🔙 Back', 'main_menu');
  }

  static pagination(currentPage, totalPages, prefix) {
    const keyboard = new InlineKeyboard();
    
    if (currentPage > 1) {
      keyboard.text('⬅️', `${prefix}_page_${currentPage - 1}`);
    }
    
    keyboard.text(`${currentPage}/${totalPages}`, 'noop');
    
    if (currentPage < totalPages) {
      keyboard.text('➡️', `${prefix}_page_${currentPage + 1}`);
    }
    
    return keyboard.row().text('🔙 Back', 'main_menu');
  }

  static dealCreatedKeyboard(inviteLink) {
    return new InlineKeyboard()
      .url('🔗 Share Group Link', inviteLink)
      .row()
      .text('🔙 Main Menu', 'main_menu');
  }

  static closeKeyboard() {
    return new InlineKeyboard().text('❌ Close', 'close');
  }

  static backButton(callback = 'main_menu') {
    return new InlineKeyboard().text('🔙 Back', callback);
  }
}

module.exports = { Keyboards };
