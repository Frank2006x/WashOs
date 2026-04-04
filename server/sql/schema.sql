CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Destructive reset for V1-only schema.
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS push_tokens CASCADE;
DROP TABLE IF EXISTS query_replies CASCADE;
DROP TABLE IF EXISTS queries CASCADE;
DROP TABLE IF EXISTS workflow_events CASCADE;
DROP TABLE IF EXISTS machine_runs CASCADE;
DROP TABLE IF EXISTS machines CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS bags CASCADE;
DROP TABLE IF EXISTS laundry_staff CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS laundry_services CASCADE;

DROP TYPE IF EXISTS workflow_event_type CASCADE;
DROP TYPE IF EXISTS query_status CASCADE;
DROP TYPE IF EXISTS machine_run_status CASCADE;
DROP TYPE IF EXISTS machine_type CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

CREATE TYPE user_role AS ENUM (
  'student',
  'laundry_staff'
);

CREATE TYPE booking_status AS ENUM (
  'created',
  'dropped_off',
  'washing',
  'wash_done',
  'drying',
  'dry_done',
  'ready_for_pickup',
  'collected'
);

CREATE TYPE machine_type AS ENUM (
  'washer',
  'dryer'
);

CREATE TYPE machine_run_status AS ENUM (
  'running',
  'finished',
  'cancelled'
);

CREATE TYPE workflow_event_type AS ENUM (
  'bag_initialized',
  'qr_rotated',
  'received',
  'wash_started',
  'wash_finished',
  'dry_started',
  'dry_finished',
  'marked_ready',
  'collected',
  'action_rejected',
  'query_raised',
  'query_acknowledged',
  'query_replied',
  'query_resolved',
  'query_closed'
);

CREATE TYPE query_status AS ENUM (
  'open',
  'acknowledged',
  'resolved',
  'closed'
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  -- Password must store bcrypt hash (legacy code can keep this column name).
  password TEXT NOT NULL,
  role user_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reg_no TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  block TEXT,
  floor_no INT,
  room_no INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE laundry_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE laundry_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  laundry_service_id UUID NOT NULL REFERENCES laundry_services(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID UNIQUE NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  qr_version INT NOT NULL DEFAULT 1 CHECK (qr_version > 0),
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  last_rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, student_id)
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id),
  bag_id UUID NOT NULL REFERENCES bags(id),
  status booking_status NOT NULL DEFAULT 'created',

  received_at TIMESTAMPTZ,
  wash_started_at TIMESTAMPTZ,
  wash_finished_at TIMESTAMPTZ,
  dry_started_at TIMESTAMPTZ,
  dry_finished_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,

  row_no TEXT,
  notes TEXT,
  last_actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bookings_student_bag_fk
    FOREIGN KEY (bag_id, student_id)
    REFERENCES bags(id, student_id)
);

CREATE TABLE machines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  laundry_service_id UUID NOT NULL REFERENCES laundry_services(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  machine_type machine_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE machine_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  bag_id UUID NOT NULL REFERENCES bags(id),
  machine_id UUID NOT NULL REFERENCES machines(id),
  machine_type machine_type NOT NULL,
  status machine_run_status NOT NULL DEFAULT 'running',
  started_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ended_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workflow_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  bag_id UUID NOT NULL REFERENCES bags(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
  triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  triggered_role user_role,
  event_type workflow_event_type NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  raised_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_staff_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  service_rating INT CHECK (service_rating BETWEEN 1 AND 5),
  handling_rating INT CHECK (handling_rating BETWEEN 1 AND 5),
  status query_status NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE query_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_id UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  replied_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE laundry_cycle_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year INT NOT NULL,
  month INT NOT NULL,
  part INT NOT NULL CHECK (part BETWEEN 1 AND 4),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year, month, part)
);

CREATE TABLE laundry_daily_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES laundry_cycle_periods(id) ON DELETE CASCADE,
  date DATE NOT NULL UNIQUE,
  start_floor INT NOT NULL,
  end_floor INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER students_set_updated_at
BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER laundry_services_set_updated_at
BEFORE UPDATE ON laundry_services
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER laundry_staff_set_updated_at
BEFORE UPDATE ON laundry_staff
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER bags_set_updated_at
BEFORE UPDATE ON bags
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER bookings_set_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER machines_set_updated_at
BEFORE UPDATE ON machines
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER machine_runs_set_updated_at
BEFORE UPDATE ON machine_runs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER push_tokens_set_updated_at
BEFORE UPDATE ON push_tokens
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER queries_set_updated_at
BEFORE UPDATE ON queries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Scalability and hot-path indexes.
CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_laundry_staff_user_id ON laundry_staff(user_id);
CREATE INDEX idx_laundry_staff_service_id ON laundry_staff(laundry_service_id);

CREATE INDEX idx_bags_student_id ON bags(student_id);
CREATE INDEX idx_bags_qr_version ON bags(qr_version);

CREATE INDEX idx_bookings_student_status_created ON bookings(student_id, status, created_at DESC);
CREATE INDEX idx_bookings_bag_created ON bookings(bag_id, created_at DESC);
CREATE INDEX idx_bookings_status_created ON bookings(status, created_at DESC);

CREATE INDEX idx_machines_service_type_active ON machines(laundry_service_id, machine_type, is_active);
CREATE INDEX idx_machine_runs_machine_status ON machine_runs(machine_id, status);
CREATE INDEX idx_machine_runs_booking ON machine_runs(booking_id);
CREATE INDEX idx_machine_runs_bag ON machine_runs(bag_id);

CREATE UNIQUE INDEX uq_machine_runs_running_machine
ON machine_runs(machine_id)
WHERE status = 'running';

CREATE INDEX idx_workflow_events_booking_created ON workflow_events(booking_id, created_at);
CREATE INDEX idx_workflow_events_bag_created ON workflow_events(bag_id, created_at);
CREATE INDEX idx_workflow_events_student_created ON workflow_events(student_id, created_at);

CREATE INDEX idx_push_tokens_user_active ON push_tokens(user_id, is_active);
CREATE INDEX idx_notifications_recipient_read_created ON notifications(recipient_user_id, is_read, created_at DESC);
CREATE INDEX idx_queries_student_created ON queries(student_id, created_at DESC);
CREATE INDEX idx_queries_status_created ON queries(status, created_at DESC);
CREATE INDEX idx_queries_booking ON queries(booking_id);
CREATE INDEX idx_queries_raised_by_user ON queries(raised_by_user_id, created_at DESC);
CREATE INDEX idx_query_replies_query_created ON query_replies(query_id, created_at ASC);
