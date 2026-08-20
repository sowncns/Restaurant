// Safe placeholders let unit tests load repositories without contacting services.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/restaurant_test";
process.env.JWT_ACCESS_SECRET ||= "unit-test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "unit-test-refresh-secret";
