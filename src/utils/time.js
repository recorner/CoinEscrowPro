const moment = require('moment');

class TimeUtils {
  static formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    
    return `${hours}h ${remainingMinutes}m`;
  }

  static getTimeRemaining(expiresAt) {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return { expired: true, text: 'Expired' };
    }
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    
    if (diffHours > 0) {
      return {
        expired: false,
        text: `${diffHours}h ${remainingMinutes}m`,
        totalMinutes: diffMinutes
      };
    } else {
      return {
        expired: false,
        text: `${diffMinutes}m`,
        totalMinutes: diffMinutes
      };
    }
  }

  static addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
  }

  static formatTimestamp(date) {
    return moment(date).format('YYYY-MM-DD HH:mm:ss UTC');
  }

  static formatRelativeTime(date) {
    return moment(date).fromNow();
  }

  static isExpired(expiresAt) {
    return new Date() > new Date(expiresAt);
  }

  static getBusinessDaysFromNow(days) {
    let date = new Date();
    let businessDays = 0;
    
    while (businessDays < days) {
      date.setDate(date.getDate() + 1);
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        businessDays++;
      }
    }
    
    return date;
  }

  static getStartOfDay(date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    return startOfDay;
  }

  static getEndOfDay(date = new Date()) {
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay;
  }
}

module.exports = { TimeUtils };
