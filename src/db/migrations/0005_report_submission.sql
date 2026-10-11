ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS report_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS report_submitted_by uuid REFERENCES users(id);
