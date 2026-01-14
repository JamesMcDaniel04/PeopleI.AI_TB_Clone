export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || '',
    name: process.env.DATABASE_NAME || 'testbox_clone',
    synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
    logging: process.env.DATABASE_LOGGING === 'true',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000', 10),
  },

  salesforce: {
    clientId: process.env.SALESFORCE_CLIENT_ID || '',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
    callbackUrl: process.env.SALESFORCE_CALLBACK_URL || 'http://localhost:3000/salesforce/callback',
    loginUrl: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com',
    oauthStateTtlMinutes: parseInt(process.env.SALESFORCE_OAUTH_STATE_TTL_MINUTES || '15', 10),
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
});
