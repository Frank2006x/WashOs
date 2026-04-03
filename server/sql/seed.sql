-- WashOs V1 Seed Data
-- Roles: student + laundry_staff only
-- Password for all users in this seed: password123

-- Laundry service baseline
INSERT INTO laundry_services (id, name, phone)
VALUES
  ('40000000-0000-0000-0000-000000000001', 'WashOs Main Laundry', '+91-9000000001')
ON CONFLICT (id) DO NOTHING;

-- Student users
INSERT INTO users (id, email, password, role)
VALUES
  ('50000000-0000-0000-0000-000000000001', 'student1@washos.com', 'password123', 'student'),
  ('50000000-0000-0000-0000-000000000002', 'student2@washos.com', 'password123', 'student'),
  ('50000000-0000-0000-0000-000000000003', 'student3@washos.com', 'password123', 'student'),
  ('50000000-0000-0000-0000-000000000004', 'student4@washos.com', 'password123', 'student'),
  ('50000000-0000-0000-0000-000000000005', 'student5@washos.com', 'password123', 'student')
ON CONFLICT (id) DO NOTHING;

-- Staff users
INSERT INTO users (id, email, password, role)
VALUES
  ('70000000-0000-0000-0000-000000000001', 'laundry1@washos.com', 'password123', 'laundry_staff'),
  ('70000000-0000-0000-0000-000000000002', 'laundry2@washos.com', 'password123', 'laundry_staff'),
  ('70000000-0000-0000-0000-000000000003', 'laundry3@washos.com', 'password123', 'laundry_staff')
ON CONFLICT (id) DO NOTHING;

-- Student profiles
INSERT INTO students (id, user_id, reg_no, name)
VALUES
  ('80000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'REG001', 'Raj Kumar'),
  ('80000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'REG002', 'Priya Singh'),
  ('80000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', 'REG003', 'Amit Patel'),
  ('80000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000004', 'REG004', 'Sneha Sharma'),
  ('80000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000005', 'REG005', 'Vikram Reddy')
ON CONFLICT (id) DO NOTHING;

-- Laundry staff profiles (phone is unique and used for signin)
INSERT INTO laundry_staff (id, user_id, name, phone, laundry_service_id)
VALUES
  ('a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Ravi Kumar', '+91-7777777701', '40000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 'Suresh Singh', '+91-7777777702', '40000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003', 'Mahesh Patil', '+91-7777777703', '40000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- One persistent bag per student
INSERT INTO bags (id, student_id, qr_version, is_revoked)
VALUES
  ('b0000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 1, FALSE),
  ('b0000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', 1, FALSE),
  ('b0000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000003', 1, FALSE),
  ('b0000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000004', 1, FALSE),
  ('b0000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000005', 1, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Washer and dryer inventory
INSERT INTO machines (id, laundry_service_id, code, machine_type, is_active)
VALUES
  ('c0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'WASH-01', 'washer', TRUE),
  ('c0000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'WASH-02', 'washer', TRUE),
  ('c0000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 'DRY-01', 'dryer', TRUE),
  ('c0000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000001', 'DRY-02', 'dryer', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Verification
SELECT 'Students created: ' || COUNT(*) FROM students;
SELECT 'Laundry staff created: ' || COUNT(*) FROM laundry_staff;
SELECT 'Bags created: ' || COUNT(*) FROM bags;
SELECT 'Machines created: ' || COUNT(*) FROM machines;
SELECT 'Total users created: ' || COUNT(*) FROM users;
