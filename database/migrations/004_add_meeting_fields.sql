-- Add phone_number and location fields to meeting_requests table
-- Migration: 004_add_meeting_fields.sql

ALTER TABLE meeting_requests ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);
ALTER TABLE meeting_requests ADD COLUMN IF NOT EXISTS location TEXT;

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_meeting_requests_phone_number ON meeting_requests(phone_number);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_location ON meeting_requests(location);