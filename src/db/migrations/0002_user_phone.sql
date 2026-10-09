-- Add optional contact numbers for clinic staff.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
