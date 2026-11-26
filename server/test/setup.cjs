// Keep tests independent of local .env files and real WeChat credentials.
process.env.MOCK_LOGIN = 'true';
process.env.JWT_SECRET = 'avalon-test-secret-not-for-production';
process.env.TOKEN_TTL = '3600';
process.env.WX_APPID = 'test-app';
process.env.WX_SECRET = 'test-secret';
