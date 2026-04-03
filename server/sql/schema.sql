CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'student',
    'staff',
    'warden',
    'admin'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM (
    'created',
    'received',
    'washing',
    'ready',
    'collected'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role user_role NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS floors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,

  floor_number INT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (block_id, floor_number)
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,

  room_number INT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (floor_id, room_number)
);

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  phone TEXT,

  room_id UUID NOT NULL REFERENCES rooms(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS laundry_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  name TEXT NOT NULL,
  phone TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS laundry_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  phone TEXT,

  laundry_service_id UUID NOT NULL REFERENCES laundry_services(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wardens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  phone TEXT,

  block_id UUID UNIQUE NOT NULL REFERENCES blocks(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  qr_code TEXT UNIQUE NOT NULL,

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  student_id UUID NOT NULL REFERENCES students(id),
  bag_id UUID NOT NULL REFERENCES bags(id),

  status booking_status NOT NULL DEFAULT 'created',

  drop_time TIMESTAMP,
  wash_complete_time TIMESTAMP,
  pickup_time TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedule_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  block_id UUID NOT NULL REFERENCES blocks(id),

  room_start INT,
  room_end INT,

  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),

  drop_start_time TIME,
  drop_end_time TIME,

  pickup_start_time TIME,
  pickup_end_time TIME,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedule_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  template_id UUID REFERENCES schedule_templates(id) ON DELETE SET NULL,

  month INT CHECK (month BETWEEN 1 AND 12),
  year INT,

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

