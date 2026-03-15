#!/bin/bash

# Setup script to initialize admin and approve test fundi

API="http://localhost:5000/api"
ADMIN_EMAIL="emmanuelevian@gmail.com"
ADMIN_PASSWORD="password123"

echo "Setting up FixIt Connect test environment..."

# Create admin in database
psql -U postgres -h localhost -d fixit_connect <<EOSQL
-- Create admin user
INSERT INTO users (id, email, password_hash, full_name, role)
VALUES ('12345678-1234-1234-1234-123456789abc', 'emmanuelevian@gmail.com', 
  '\$2b\$10\$N9qo8uLOickgx2ZMRZoMye.2IZvI/ViPXfFMYz5xvLi3U7yFNRQw.', 
  'Admin User', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Create token_blacklist table if not exists
CREATE TABLE IF NOT EXISTS token_blacklist (
  token TEXT PRIMARY KEY,
  user_id UUID,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

EOSQL

echo "Admin setup complete!"
echo "You can now login with:"
echo "  Email: $ADMIN_EMAIL"
echo "  Password: $ADMIN_PASSWORD"
