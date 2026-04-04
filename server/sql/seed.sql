-- WashOs V1 Seed Data
-- Roles: student + laundry_staff only
-- Password for all users in this seed: password123

-- Laundry service baseline
INSERT INTO laundry_services (id, name, phone)
VALUES
  ('40000000-0000-0000-0000-000000000001', 'WashOs Main Laundry', '+91-9000000001')
ON CONFLICT DO NOTHING;

-- Student users
INSERT INTO users (id, email, password, role)
VALUES
  ('50000000-0000-0000-0000-000000000001', 'student1@washos.com', 'password123', 'student'),
  ('50000000-0000-0000-0000-000000000002', 'student2@washos.com', 'password123', 'student'),
  ('50000000-0000-0000-0000-000000000003', 'student3@washos.com', 'password123', 'student'),
  ('50000000-0000-0000-0000-000000000004', 'student4@washos.com', 'password123', 'student'),
  ('50000000-0000-0000-0000-000000000005', 'student5@washos.com', 'password123', 'student')
ON CONFLICT DO NOTHING;

-- Staff users
INSERT INTO users (id, email, password, role)
VALUES
  ('70000000-0000-0000-0000-000000000001', 'laundry1@washos.com', 'password123', 'laundry_staff'),
  ('70000000-0000-0000-0000-000000000002', 'laundry2@washos.com', 'password123', 'laundry_staff'),
  ('70000000-0000-0000-0000-000000000003', 'laundry3@washos.com', 'password123', 'laundry_staff')
ON CONFLICT DO NOTHING;

-- Student profiles
INSERT INTO students (id, user_id, reg_no, name)
VALUES
  ('80000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'REG001', 'Raj Kumar'),
  ('80000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'REG002', 'Priya Singh'),
  ('80000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', 'REG003', 'Amit Patel'),
  ('80000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000004', 'REG004', 'Sneha Sharma'),
  ('80000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000005', 'REG005', 'Vikram Reddy')
ON CONFLICT DO NOTHING;

UPDATE students
SET floor_no = CASE reg_no
  WHEN 'REG001' THEN 1
  WHEN 'REG002' THEN 2
  WHEN 'REG003' THEN 3
  WHEN 'REG004' THEN 4
  WHEN 'REG005' THEN 5
  ELSE floor_no
END
WHERE reg_no IN ('REG001', 'REG002', 'REG003', 'REG004', 'REG005');

-- Laundry staff profiles (phone is unique and used for signin)
WITH svc AS (
  SELECT COALESCE(
    (SELECT id FROM laundry_services WHERE name = 'WashOs Main Laundry' LIMIT 1),
    (SELECT id FROM laundry_services ORDER BY created_at ASC LIMIT 1)
  ) AS id
)
INSERT INTO laundry_staff (id, user_id, name, phone, laundry_service_id)
SELECT
  row.id,
  row.user_id,
  row.name,
  row.phone,
  svc.id
FROM svc
CROSS JOIN (
  VALUES
    ('a0000000-0000-0000-0000-000000000001'::uuid, '70000000-0000-0000-0000-000000000001'::uuid, 'Ravi Kumar', '+91-7777777701'),
    ('a0000000-0000-0000-0000-000000000002'::uuid, '70000000-0000-0000-0000-000000000002'::uuid, 'Suresh Singh', '+91-7777777702'),
    ('a0000000-0000-0000-0000-000000000003'::uuid, '70000000-0000-0000-0000-000000000003'::uuid, 'Mahesh Patil', '+91-7777777703')
) AS row(id, user_id, name, phone)
ON CONFLICT DO NOTHING;

-- One persistent bag per student
INSERT INTO bags (id, student_id, qr_version, is_revoked)
VALUES
  ('b0000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 1, FALSE),
  ('b0000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', 1, FALSE),
  ('b0000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000003', 1, FALSE),
  ('b0000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000004', 1, FALSE),
  ('b0000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000005', 1, FALSE)
ON CONFLICT DO NOTHING;

-- Washer and dryer inventory
WITH svc AS (
  SELECT COALESCE(
    (SELECT id FROM laundry_services WHERE name = 'WashOs Main Laundry' LIMIT 1),
    (SELECT id FROM laundry_services ORDER BY created_at ASC LIMIT 1)
  ) AS id
)
INSERT INTO machines (id, laundry_service_id, code, machine_type, is_active)
SELECT
  row.id,
  svc.id,
  row.code,
  row.machine_type,
  TRUE
FROM svc
CROSS JOIN (
  VALUES
    ('c0000000-0000-0000-0000-000000000001'::uuid, 'WASH-01', 'washer'::machine_type),
    ('c0000000-0000-0000-0000-000000000002'::uuid, 'WASH-02', 'washer'::machine_type),
    ('c0000000-0000-0000-0000-000000000003'::uuid, 'DRY-01', 'dryer'::machine_type),
    ('c0000000-0000-0000-0000-000000000004'::uuid, 'DRY-02', 'dryer'::machine_type),
    ('c0000000-0000-0000-0000-000000000005'::uuid, 'WASH-03', 'washer'::machine_type),
    ('c0000000-0000-0000-0000-000000000006'::uuid, 'WASH-04', 'washer'::machine_type),
    ('c0000000-0000-0000-0000-000000000007'::uuid, 'WASH-05', 'washer'::machine_type),
    ('c0000000-0000-0000-0000-000000000008'::uuid, 'WASH-06', 'washer'::machine_type),
    ('c0000000-0000-0000-0000-000000000009'::uuid, 'WASH-07', 'washer'::machine_type),
    ('c0000000-0000-0000-0000-000000000010'::uuid, 'WASH-08', 'washer'::machine_type),
    ('c0000000-0000-0000-0000-000000000011'::uuid, 'WASH-09', 'washer'::machine_type),
    ('c0000000-0000-0000-0000-000000000012'::uuid, 'WASH-10', 'washer'::machine_type),
    ('c0000000-0000-0000-0000-000000000013'::uuid, 'DRY-03', 'dryer'::machine_type),
    ('c0000000-0000-0000-0000-000000000014'::uuid, 'DRY-04', 'dryer'::machine_type),
    ('c0000000-0000-0000-0000-000000000015'::uuid, 'DRY-05', 'dryer'::machine_type),
    ('c0000000-0000-0000-0000-000000000016'::uuid, 'DRY-06', 'dryer'::machine_type),
    ('c0000000-0000-0000-0000-000000000017'::uuid, 'DRY-07', 'dryer'::machine_type),
    ('c0000000-0000-0000-0000-000000000018'::uuid, 'DRY-08', 'dryer'::machine_type),
    ('c0000000-0000-0000-0000-000000000019'::uuid, 'DRY-09', 'dryer'::machine_type),
    ('c0000000-0000-0000-0000-000000000020'::uuid, 'DRY-10', 'dryer'::machine_type)
) AS row(id, code, machine_type)
ON CONFLICT DO NOTHING;

-- Sample completed booking with workflow timeline (for frontend event log visibility)
INSERT INTO bookings (
  id,
  student_id,
  bag_id,
  status,
  received_at,
  wash_started_at,
  wash_finished_at,
  dry_started_at,
  dry_finished_at,
  ready_at,
  collected_at,
  row_no,
  notes,
  last_actor_user_id
)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'collected',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days' + INTERVAL '30 minutes',
  NOW() - INTERVAL '2 days' + INTERVAL '75 minutes',
  NOW() - INTERVAL '2 days' + INTERVAL '90 minutes',
  NOW() - INTERVAL '2 days' + INTERVAL '130 minutes',
  NOW() - INTERVAL '2 days' + INTERVAL '150 minutes',
  NOW() - INTERVAL '2 days' + INTERVAL '6 hours',
  'A-12',
  'seeded completed flow',
  '50000000-0000-0000-0000-000000000001'
)
ON CONFLICT DO NOTHING;

INSERT INTO workflow_events (
  id,
  booking_id,
  bag_id,
  student_id,
  machine_id,
  triggered_by_user_id,
  triggered_role,
  event_type,
  metadata,
  created_at
)
VALUES
  (
    'e0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    NULL,
    '70000000-0000-0000-0000-000000000001',
    'laundry_staff',
    'received',
    '{"source":"seed_intake"}'::jsonb,
    NOW() - INTERVAL '2 days'
  ),
  (
    'e0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    'laundry_staff',
    'wash_started',
    '{"source":"seed_wash_start","machine_code":"WASH-01"}'::jsonb,
    NOW() - INTERVAL '2 days' + INTERVAL '30 minutes'
  ),
  (
    'e0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    'laundry_staff',
    'wash_finished',
    '{"source":"seed_wash_finish","machine_code":"WASH-01"}'::jsonb,
    NOW() - INTERVAL '2 days' + INTERVAL '75 minutes'
  ),
  (
    'e0000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000013',
    '70000000-0000-0000-0000-000000000001',
    'laundry_staff',
    'dry_started',
    '{"source":"seed_dry_start","machine_code":"DRY-03"}'::jsonb,
    NOW() - INTERVAL '2 days' + INTERVAL '90 minutes'
  ),
  (
    'e0000000-0000-0000-0000-000000000005',
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000013',
    '70000000-0000-0000-0000-000000000001',
    'laundry_staff',
    'dry_finished',
    '{"source":"seed_dry_finish","machine_code":"DRY-03"}'::jsonb,
    NOW() - INTERVAL '2 days' + INTERVAL '130 minutes'
  ),
  (
    'e0000000-0000-0000-0000-000000000006',
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    NULL,
    '70000000-0000-0000-0000-000000000001',
    'laundry_staff',
    'marked_ready',
    '{"source":"seed_ready","row_no":"A-12"}'::jsonb,
    NOW() - INTERVAL '2 days' + INTERVAL '150 minutes'
  ),
  (
    'e0000000-0000-0000-0000-000000000007',
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    NULL,
    '50000000-0000-0000-0000-000000000001',
    'student',
    'collected',
    '{"source":"seed_collect"}'::jsonb,
    NOW() - INTERVAL '2 days' + INTERVAL '6 hours'
  )
ON CONFLICT DO NOTHING;

-- Slot windows for the next 365 days: 1-hour windows from 09:00 to 21:00
-- for all floor bands every day (1-2, 3-4, 5-6, 7-8).
WITH day_slots AS (
  SELECT (CURRENT_DATE + offs)::date AS slot_date
  FROM generate_series(0, 364) AS offs
), floor_bands AS (
  SELECT *
  FROM (
    VALUES
      (1, 2, 1),
      (3, 4, 2),
      (5, 6, 3),
      (7, 8, 4)
  ) AS fb(start_floor, end_floor, cycle_part)
), hour_slots AS (
  SELECT generate_series(9, 20) AS hr
)
INSERT INTO slot_windows (
  date,
  start_time,
  end_time,
  allowed_start_floor,
  allowed_end_floor,
  cycle_part,
  capacity_limit,
  day_limit
)
SELECT
  ds.slot_date,
  make_time(hs.hr, 0, 0),
  make_time(hs.hr + 1, 0, 0),
  fb.start_floor,
  fb.end_floor,
  fb.cycle_part,
  100,
  600
FROM day_slots ds
CROSS JOIN floor_bands fb
CROSS JOIN hour_slots hs
ON CONFLICT DO NOTHING;

-- Verification
SELECT 'Students created: ' || COUNT(*) FROM students;
SELECT 'Laundry staff created: ' || COUNT(*) FROM laundry_staff;
SELECT 'Bags created: ' || COUNT(*) FROM bags;
SELECT 'Machines created: ' || COUNT(*) FROM machines;
SELECT 'Bookings created: ' || COUNT(*) FROM bookings;
SELECT 'Workflow events created: ' || COUNT(*) FROM workflow_events;
SELECT 'Slot windows created: ' || COUNT(*) FROM slot_windows;
SELECT 'Total users created: ' || COUNT(*) FROM users;
