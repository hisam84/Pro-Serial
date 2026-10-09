-- Serial Pro — 0001_init.sql
-- Initial schema for PostgreSQL (Neon) / PGlite.
-- Statements are separated by "--> statement-breakpoint" markers.

CREATE TYPE clinic_status AS ENUM ('active', 'suspended', 'deactivated');
--> statement-breakpoint
CREATE TYPE user_role AS ENUM ('super_admin', 'clinic_admin', 'attendant', 'doctor');
--> statement-breakpoint
CREATE TYPE user_status AS ENUM ('active', 'disabled');
--> statement-breakpoint
CREATE TYPE doctor_status AS ENUM ('active', 'inactive');
--> statement-breakpoint
CREATE TYPE patient_type AS ENUM ('new', 'old');
--> statement-breakpoint
CREATE TYPE appointment_status AS ENUM ('active', 'cancelled');
--> statement-breakpoint
CREATE TABLE clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'Asia/Dhaka',
  require_address boolean NOT NULL DEFAULT false,
  status clinic_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id),
  name text NOT NULL,
  username text NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  status user_status NOT NULL DEFAULT 'active',
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX users_username_uq ON users (username);
--> statement-breakpoint
CREATE INDEX users_clinic_idx ON users (clinic_id);
--> statement-breakpoint
CREATE TABLE doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  name text NOT NULL,
  specialty text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  profile_image_url text,
  instructions text NOT NULL DEFAULT '',
  sms_template text,
  status doctor_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX doctors_clinic_idx ON doctors (clinic_id);
--> statement-breakpoint
CREATE TABLE doctor_attendants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX doctor_attendants_uq ON doctor_attendants (doctor_id, user_id);
--> statement-breakpoint
CREATE INDEX doctor_attendants_user_idx ON doctor_attendants (user_id);
--> statement-breakpoint
CREATE INDEX doctor_attendants_clinic_idx ON doctor_attendants (clinic_id);
--> statement-breakpoint
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  mobile_normalized text NOT NULL,
  mobile_display text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX patients_clinic_mobile_idx ON patients (clinic_id, mobile_normalized);
--> statement-breakpoint
CREATE INDEX patients_clinic_name_idx ON patients (clinic_id, name);
--> statement-breakpoint
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  doctor_id uuid NOT NULL REFERENCES doctors(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  appointment_date date NOT NULL,
  patient_type patient_type NOT NULL,
  serial_number integer,
  is_reference boolean NOT NULL DEFAULT false,
  reference_details text,
  status appointment_status NOT NULL DEFAULT 'active',
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  cancelled_by uuid REFERENCES users(id),
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX appointments_clinic_doctor_date_idx ON appointments (clinic_id, doctor_id, appointment_date);
--> statement-breakpoint
CREATE INDEX appointments_patient_idx ON appointments (patient_id);
--> statement-breakpoint
CREATE INDEX appointments_created_by_idx ON appointments (created_by);
--> statement-breakpoint
CREATE UNIQUE INDEX appointments_serial_uq
  ON appointments (clinic_id, doctor_id, appointment_date, patient_type, serial_number)
  WHERE is_reference = false AND serial_number IS NOT NULL;
--> statement-breakpoint
CREATE TABLE serial_counters (
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  doctor_id uuid NOT NULL REFERENCES doctors(id),
  appointment_date date NOT NULL,
  patient_type patient_type NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, doctor_id, appointment_date, patient_type)
);
--> statement-breakpoint
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX sessions_token_hash_uq ON sessions (token_hash);
--> statement-breakpoint
CREATE INDEX sessions_user_idx ON sessions (user_id);
--> statement-breakpoint
CREATE INDEX sessions_expires_idx ON sessions (expires_at);
--> statement-breakpoint
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id),
  actor_user_id uuid REFERENCES users(id),
  actor_name text NOT NULL DEFAULT '',
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX audit_clinic_idx ON audit_logs (clinic_id);
--> statement-breakpoint
CREATE INDEX audit_entity_idx ON audit_logs (entity_type, entity_id);
--> statement-breakpoint
CREATE INDEX audit_actor_idx ON audit_logs (actor_user_id);
