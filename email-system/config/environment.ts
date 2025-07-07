interface Config {
  MAILGUN_API_KEY: string;
  MAILGUN_DOMAIN: string;
  BASE_URL: string;
  NODE_ENV: string;
}

class ConfigManager {
  private config: Partial<Config>;

  constructor() {
    this.config = {
      MAILGUN_API_KEY: process.env.MAILGUN_API_KEY || '',
      MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || 'mail.onerylie.com',
      BASE_URL: process.env.BASE_URL || 'http://localhost:5000',
      NODE_ENV: process.env.NODE_ENV || 'development'
    };
  }

  get(): Config {
    return this.config as Config;
  }

  isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }
}

export default new ConfigManager();