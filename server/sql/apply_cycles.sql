-- Monthly Cycle Periods and Daily Floor Slots for 2026
BEGIN;
-- Ensure tables exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS laundry_cycle_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year INT NOT NULL,
  month INT NOT NULL,
  part INT NOT NULL CHECK (part BETWEEN 1 AND 4),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year, month, part)
);
CREATE TABLE IF NOT EXISTS laundry_daily_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES laundry_cycle_periods(id) ON DELETE CASCADE,
  date DATE NOT NULL UNIQUE,
  start_floor INT NOT NULL,
  end_floor INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
TRUNCATE laundry_daily_slots, laundry_cycle_periods CASCADE;
WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 1, 1, '2026-01-01', '2026-01-08')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-01-01', 1, 3),
    (DATE '2026-01-02', 4, 6),
    (DATE '2026-01-03', 7, 8),
    (DATE '2026-01-05', 9, 10),
    (DATE '2026-01-06', 11, 12),
    (DATE '2026-01-07', 13, 14),
    (DATE '2026-01-08', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 1, 2, '2026-01-09', '2026-01-16')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-01-09', 1, 3),
    (DATE '2026-01-10', 4, 6),
    (DATE '2026-01-12', 7, 8),
    (DATE '2026-01-13', 9, 10),
    (DATE '2026-01-14', 11, 12),
    (DATE '2026-01-15', 13, 14),
    (DATE '2026-01-16', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 1, 3, '2026-01-17', '2026-01-24')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-01-17', 1, 3),
    (DATE '2026-01-19', 4, 6),
    (DATE '2026-01-20', 7, 8),
    (DATE '2026-01-21', 9, 10),
    (DATE '2026-01-22', 11, 12),
    (DATE '2026-01-23', 13, 14),
    (DATE '2026-01-24', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 1, 4, '2026-01-26', '2026-01-31')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-01-26', 1, 3),
    (DATE '2026-01-27', 4, 6),
    (DATE '2026-01-28', 7, 9),
    (DATE '2026-01-29', 10, 12),
    (DATE '2026-01-30', 13, 14),
    (DATE '2026-01-31', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 2, 1, '2026-02-02', '2026-02-07')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-02-02', 1, 3),
    (DATE '2026-02-03', 4, 6),
    (DATE '2026-02-04', 7, 9),
    (DATE '2026-02-05', 10, 12),
    (DATE '2026-02-06', 13, 14),
    (DATE '2026-02-07', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 2, 2, '2026-02-09', '2026-02-14')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-02-09', 1, 3),
    (DATE '2026-02-10', 4, 6),
    (DATE '2026-02-11', 7, 9),
    (DATE '2026-02-12', 10, 12),
    (DATE '2026-02-13', 13, 14),
    (DATE '2026-02-14', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 2, 3, '2026-02-16', '2026-02-21')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-02-16', 1, 3),
    (DATE '2026-02-17', 4, 6),
    (DATE '2026-02-18', 7, 9),
    (DATE '2026-02-19', 10, 12),
    (DATE '2026-02-20', 13, 14),
    (DATE '2026-02-21', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 2, 4, '2026-02-23', '2026-02-28')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-02-23', 1, 3),
    (DATE '2026-02-24', 4, 6),
    (DATE '2026-02-25', 7, 9),
    (DATE '2026-02-26', 10, 12),
    (DATE '2026-02-27', 13, 14),
    (DATE '2026-02-28', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 3, 1, '2026-03-02', '2026-03-09')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-03-02', 1, 3),
    (DATE '2026-03-03', 4, 6),
    (DATE '2026-03-04', 7, 8),
    (DATE '2026-03-05', 9, 10),
    (DATE '2026-03-06', 11, 12),
    (DATE '2026-03-07', 13, 14),
    (DATE '2026-03-09', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 3, 2, '2026-03-10', '2026-03-17')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-03-10', 1, 3),
    (DATE '2026-03-11', 4, 6),
    (DATE '2026-03-12', 7, 8),
    (DATE '2026-03-13', 9, 10),
    (DATE '2026-03-14', 11, 12),
    (DATE '2026-03-16', 13, 14),
    (DATE '2026-03-17', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 3, 3, '2026-03-18', '2026-03-24')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-03-18', 1, 3),
    (DATE '2026-03-19', 4, 6),
    (DATE '2026-03-20', 7, 9),
    (DATE '2026-03-21', 10, 12),
    (DATE '2026-03-23', 13, 14),
    (DATE '2026-03-24', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 3, 4, '2026-03-25', '2026-03-31')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-03-25', 1, 3),
    (DATE '2026-03-26', 4, 6),
    (DATE '2026-03-27', 7, 9),
    (DATE '2026-03-28', 10, 12),
    (DATE '2026-03-30', 13, 14),
    (DATE '2026-03-31', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 4, 1, '2026-04-01', '2026-04-08')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-04-01', 1, 3),
    (DATE '2026-04-02', 4, 6),
    (DATE '2026-04-03', 7, 8),
    (DATE '2026-04-04', 9, 10),
    (DATE '2026-04-06', 11, 12),
    (DATE '2026-04-07', 13, 14),
    (DATE '2026-04-08', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 4, 2, '2026-04-09', '2026-04-16')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-04-09', 1, 3),
    (DATE '2026-04-10', 4, 6),
    (DATE '2026-04-11', 7, 8),
    (DATE '2026-04-13', 9, 10),
    (DATE '2026-04-14', 11, 12),
    (DATE '2026-04-15', 13, 14),
    (DATE '2026-04-16', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 4, 3, '2026-04-17', '2026-04-23')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-04-17', 1, 3),
    (DATE '2026-04-18', 4, 6),
    (DATE '2026-04-20', 7, 9),
    (DATE '2026-04-21', 10, 12),
    (DATE '2026-04-22', 13, 14),
    (DATE '2026-04-23', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 4, 4, '2026-04-24', '2026-04-30')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-04-24', 1, 3),
    (DATE '2026-04-25', 4, 6),
    (DATE '2026-04-27', 7, 9),
    (DATE '2026-04-28', 10, 12),
    (DATE '2026-04-29', 13, 14),
    (DATE '2026-04-30', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 5, 1, '2026-05-01', '2026-05-08')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-05-01', 1, 3),
    (DATE '2026-05-02', 4, 6),
    (DATE '2026-05-04', 7, 8),
    (DATE '2026-05-05', 9, 10),
    (DATE '2026-05-06', 11, 12),
    (DATE '2026-05-07', 13, 14),
    (DATE '2026-05-08', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 5, 2, '2026-05-09', '2026-05-16')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-05-09', 1, 3),
    (DATE '2026-05-11', 4, 6),
    (DATE '2026-05-12', 7, 8),
    (DATE '2026-05-13', 9, 10),
    (DATE '2026-05-14', 11, 12),
    (DATE '2026-05-15', 13, 14),
    (DATE '2026-05-16', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 5, 3, '2026-05-18', '2026-05-23')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-05-18', 1, 3),
    (DATE '2026-05-19', 4, 6),
    (DATE '2026-05-20', 7, 9),
    (DATE '2026-05-21', 10, 12),
    (DATE '2026-05-22', 13, 14),
    (DATE '2026-05-23', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 5, 4, '2026-05-25', '2026-05-30')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-05-25', 1, 3),
    (DATE '2026-05-26', 4, 6),
    (DATE '2026-05-27', 7, 9),
    (DATE '2026-05-28', 10, 12),
    (DATE '2026-05-29', 13, 14),
    (DATE '2026-05-30', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 6, 1, '2026-06-01', '2026-06-08')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-06-01', 1, 3),
    (DATE '2026-06-02', 4, 6),
    (DATE '2026-06-03', 7, 8),
    (DATE '2026-06-04', 9, 10),
    (DATE '2026-06-05', 11, 12),
    (DATE '2026-06-06', 13, 14),
    (DATE '2026-06-08', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 6, 2, '2026-06-09', '2026-06-16')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-06-09', 1, 3),
    (DATE '2026-06-10', 4, 6),
    (DATE '2026-06-11', 7, 8),
    (DATE '2026-06-12', 9, 10),
    (DATE '2026-06-13', 11, 12),
    (DATE '2026-06-15', 13, 14),
    (DATE '2026-06-16', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 6, 3, '2026-06-17', '2026-06-23')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-06-17', 1, 3),
    (DATE '2026-06-18', 4, 6),
    (DATE '2026-06-19', 7, 9),
    (DATE '2026-06-20', 10, 12),
    (DATE '2026-06-22', 13, 14),
    (DATE '2026-06-23', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 6, 4, '2026-06-24', '2026-06-30')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-06-24', 1, 3),
    (DATE '2026-06-25', 4, 6),
    (DATE '2026-06-26', 7, 9),
    (DATE '2026-06-27', 10, 12),
    (DATE '2026-06-29', 13, 14),
    (DATE '2026-06-30', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 7, 1, '2026-07-01', '2026-07-08')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-07-01', 1, 3),
    (DATE '2026-07-02', 4, 6),
    (DATE '2026-07-03', 7, 8),
    (DATE '2026-07-04', 9, 10),
    (DATE '2026-07-06', 11, 12),
    (DATE '2026-07-07', 13, 14),
    (DATE '2026-07-08', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 7, 2, '2026-07-09', '2026-07-16')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-07-09', 1, 3),
    (DATE '2026-07-10', 4, 6),
    (DATE '2026-07-11', 7, 8),
    (DATE '2026-07-13', 9, 10),
    (DATE '2026-07-14', 11, 12),
    (DATE '2026-07-15', 13, 14),
    (DATE '2026-07-16', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 7, 3, '2026-07-17', '2026-07-24')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-07-17', 1, 3),
    (DATE '2026-07-18', 4, 6),
    (DATE '2026-07-20', 7, 8),
    (DATE '2026-07-21', 9, 10),
    (DATE '2026-07-22', 11, 12),
    (DATE '2026-07-23', 13, 14),
    (DATE '2026-07-24', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 7, 4, '2026-07-25', '2026-07-31')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-07-25', 1, 3),
    (DATE '2026-07-27', 4, 6),
    (DATE '2026-07-28', 7, 9),
    (DATE '2026-07-29', 10, 12),
    (DATE '2026-07-30', 13, 14),
    (DATE '2026-07-31', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 8, 1, '2026-08-01', '2026-08-08')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-08-01', 1, 3),
    (DATE '2026-08-03', 4, 6),
    (DATE '2026-08-04', 7, 8),
    (DATE '2026-08-05', 9, 10),
    (DATE '2026-08-06', 11, 12),
    (DATE '2026-08-07', 13, 14),
    (DATE '2026-08-08', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 8, 2, '2026-08-10', '2026-08-17')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-08-10', 1, 3),
    (DATE '2026-08-11', 4, 6),
    (DATE '2026-08-12', 7, 8),
    (DATE '2026-08-13', 9, 10),
    (DATE '2026-08-14', 11, 12),
    (DATE '2026-08-15', 13, 14),
    (DATE '2026-08-17', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 8, 3, '2026-08-18', '2026-08-24')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-08-18', 1, 3),
    (DATE '2026-08-19', 4, 6),
    (DATE '2026-08-20', 7, 9),
    (DATE '2026-08-21', 10, 12),
    (DATE '2026-08-22', 13, 14),
    (DATE '2026-08-24', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 8, 4, '2026-08-25', '2026-08-31')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-08-25', 1, 3),
    (DATE '2026-08-26', 4, 6),
    (DATE '2026-08-27', 7, 9),
    (DATE '2026-08-28', 10, 12),
    (DATE '2026-08-29', 13, 14),
    (DATE '2026-08-31', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 9, 1, '2026-09-01', '2026-09-08')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-09-01', 1, 3),
    (DATE '2026-09-02', 4, 6),
    (DATE '2026-09-03', 7, 8),
    (DATE '2026-09-04', 9, 10),
    (DATE '2026-09-05', 11, 12),
    (DATE '2026-09-07', 13, 14),
    (DATE '2026-09-08', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 9, 2, '2026-09-09', '2026-09-16')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-09-09', 1, 3),
    (DATE '2026-09-10', 4, 6),
    (DATE '2026-09-11', 7, 8),
    (DATE '2026-09-12', 9, 10),
    (DATE '2026-09-14', 11, 12),
    (DATE '2026-09-15', 13, 14),
    (DATE '2026-09-16', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 9, 3, '2026-09-17', '2026-09-23')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-09-17', 1, 3),
    (DATE '2026-09-18', 4, 6),
    (DATE '2026-09-19', 7, 9),
    (DATE '2026-09-21', 10, 12),
    (DATE '2026-09-22', 13, 14),
    (DATE '2026-09-23', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 9, 4, '2026-09-24', '2026-09-30')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-09-24', 1, 3),
    (DATE '2026-09-25', 4, 6),
    (DATE '2026-09-26', 7, 9),
    (DATE '2026-09-28', 10, 12),
    (DATE '2026-09-29', 13, 14),
    (DATE '2026-09-30', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 10, 1, '2026-10-01', '2026-10-08')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-10-01', 1, 3),
    (DATE '2026-10-02', 4, 6),
    (DATE '2026-10-03', 7, 8),
    (DATE '2026-10-05', 9, 10),
    (DATE '2026-10-06', 11, 12),
    (DATE '2026-10-07', 13, 14),
    (DATE '2026-10-08', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 10, 2, '2026-10-09', '2026-10-16')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-10-09', 1, 3),
    (DATE '2026-10-10', 4, 6),
    (DATE '2026-10-12', 7, 8),
    (DATE '2026-10-13', 9, 10),
    (DATE '2026-10-14', 11, 12),
    (DATE '2026-10-15', 13, 14),
    (DATE '2026-10-16', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 10, 3, '2026-10-17', '2026-10-24')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-10-17', 1, 3),
    (DATE '2026-10-19', 4, 6),
    (DATE '2026-10-20', 7, 8),
    (DATE '2026-10-21', 9, 10),
    (DATE '2026-10-22', 11, 12),
    (DATE '2026-10-23', 13, 14),
    (DATE '2026-10-24', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 10, 4, '2026-10-26', '2026-10-31')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-10-26', 1, 3),
    (DATE '2026-10-27', 4, 6),
    (DATE '2026-10-28', 7, 9),
    (DATE '2026-10-29', 10, 12),
    (DATE '2026-10-30', 13, 14),
    (DATE '2026-10-31', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 11, 1, '2026-11-02', '2026-11-09')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-11-02', 1, 3),
    (DATE '2026-11-03', 4, 6),
    (DATE '2026-11-04', 7, 8),
    (DATE '2026-11-05', 9, 10),
    (DATE '2026-11-06', 11, 12),
    (DATE '2026-11-07', 13, 14),
    (DATE '2026-11-09', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 11, 2, '2026-11-10', '2026-11-16')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-11-10', 1, 3),
    (DATE '2026-11-11', 4, 6),
    (DATE '2026-11-12', 7, 9),
    (DATE '2026-11-13', 10, 12),
    (DATE '2026-11-14', 13, 14),
    (DATE '2026-11-16', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 11, 3, '2026-11-17', '2026-11-23')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-11-17', 1, 3),
    (DATE '2026-11-18', 4, 6),
    (DATE '2026-11-19', 7, 9),
    (DATE '2026-11-20', 10, 12),
    (DATE '2026-11-21', 13, 14),
    (DATE '2026-11-23', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 11, 4, '2026-11-24', '2026-11-30')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-11-24', 1, 3),
    (DATE '2026-11-25', 4, 6),
    (DATE '2026-11-26', 7, 9),
    (DATE '2026-11-27', 10, 12),
    (DATE '2026-11-28', 13, 14),
    (DATE '2026-11-30', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 12, 1, '2026-12-01', '2026-12-08')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-12-01', 1, 3),
    (DATE '2026-12-02', 4, 6),
    (DATE '2026-12-03', 7, 8),
    (DATE '2026-12-04', 9, 10),
    (DATE '2026-12-05', 11, 12),
    (DATE '2026-12-07', 13, 14),
    (DATE '2026-12-08', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 12, 2, '2026-12-09', '2026-12-16')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-12-09', 1, 3),
    (DATE '2026-12-10', 4, 6),
    (DATE '2026-12-11', 7, 8),
    (DATE '2026-12-12', 9, 10),
    (DATE '2026-12-14', 11, 12),
    (DATE '2026-12-15', 13, 14),
    (DATE '2026-12-16', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 12, 3, '2026-12-17', '2026-12-24')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-12-17', 1, 3),
    (DATE '2026-12-18', 4, 6),
    (DATE '2026-12-19', 7, 8),
    (DATE '2026-12-21', 9, 10),
    (DATE '2026-12-22', 11, 12),
    (DATE '2026-12-23', 13, 14),
    (DATE '2026-12-24', 15, 16)
) AS d(date, sf, ef);

WITH inserted_cycle AS (
  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)
  VALUES (2026, 12, 4, '2026-12-25', '2026-12-31')
  RETURNING id
)
INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)
SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (
  VALUES
    (DATE '2026-12-25', 1, 3),
    (DATE '2026-12-26', 4, 6),
    (DATE '2026-12-28', 7, 9),
    (DATE '2026-12-29', 10, 12),
    (DATE '2026-12-30', 13, 14),
    (DATE '2026-12-31', 15, 16)
) AS d(date, sf, ef);

COMMIT;
