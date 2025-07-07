-- migrations/001_init.sql
-- Initial database setup for CCL

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS visitors (
  id SERIAL PRIMARY KEY,
  visitor_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  visitor_id VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  status VARCHAR(50) DEFAULT 'new',
  source VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  visitor_id VARCHAR(255),
  lead_id INTEGER REFERENCES leads(id),
  content TEXT,
  is_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_visitor_id ON leads(visitor_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_messages_visitor_id ON messages(visitor_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);

-- Insert some test data
INSERT INTO leads (visitor_id, email, phone, first_name, last_name, status, source) 
VALUES 
  ('test-001', 'john.doe@example.com', '+1234567890', 'John', 'Doe', 'new', 'website'),
  ('test-002', 'jane.smith@example.com', '+0987654321', 'Jane', 'Smith', 'contacted', 'campaign')
ON CONFLICT DO NOTHING;
