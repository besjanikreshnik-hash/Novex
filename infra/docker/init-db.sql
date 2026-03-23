-- NovEx Database Initialization
-- This runs on first postgres container startup

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create test database for integration tests
CREATE DATABASE novex_test;
GRANT ALL PRIVILEGES ON DATABASE novex_test TO novex;
