package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func loadSchemaSQL() (string, error) {
	paths := []string{
		"sql/schema.sql",
		"../sql/schema.sql",
		"../../sql/schema.sql",
		"../../../sql/schema.sql",
	}

	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			b, readErr := os.ReadFile(p)
			if readErr != nil {
				return "", readErr
			}
			fmt.Printf("Applying schema from %s\n", filepath.Clean(p))
			return string(b), nil
		}
	}

	return "", fmt.Errorf("schema file not found in expected paths")
}

func nullableToString(v *string) string {
	if v == nil {
		return "<missing>"
	}
	return *v
}

func main() {
	for _, p := range []string{".env", "../.env", "../../.env", "../../../.env"} {
		if _, err := os.Stat(p); err == nil {
			_ = godotenv.Overload(p)
			break
		}
	}

	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal("connect:", err)
	}
	defer pool.Close()

	schemaSQL, err := loadSchemaSQL()
	if err != nil {
		log.Fatal("load schema:", err)
	}

	if _, err = pool.Exec(context.Background(), schemaSQL); err != nil {
		log.Fatal("schema apply failed:", err)
	}

	// Seed slot windows directly from migrate so environments without psql
	// still get schedulable slots for Postman/API flows.
	if _, err = pool.Exec(context.Background(), `
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
	`); err != nil {
		log.Fatal("slot seed failed:", err)
	}

	_, err = pool.Exec(context.Background(), `
		ALTER TABLE students ADD COLUMN IF NOT EXISTS block TEXT;
		ALTER TABLE students ADD COLUMN IF NOT EXISTS floor_no INT;

		DO $$
		DECLARE
			room_type TEXT;
		BEGIN
			SELECT data_type
			INTO room_type
			FROM information_schema.columns
			WHERE table_name = 'students' AND column_name = 'room_no';

			IF room_type IS NULL THEN
				ALTER TABLE students ADD COLUMN room_no INT;
			ELSIF room_type <> 'integer' THEN
				ALTER TABLE students ADD COLUMN IF NOT EXISTS room_no_tmp INT;
				UPDATE students
				SET room_no_tmp = CASE
					WHEN trim(room_no::text) ~ '^[0-9]+$' THEN room_no::int
					ELSE NULL
				END;
				ALTER TABLE students DROP COLUMN room_no;
				ALTER TABLE students RENAME COLUMN room_no_tmp TO room_no;
			END IF;
		END $$;
	`)
	if err != nil {
		log.Fatal("migration failed:", err)
	}

	var slotWindows, slotReservations, slotOverrides *string
	if err := pool.QueryRow(context.Background(), `
		SELECT
			to_regclass('public.slot_windows')::text,
			to_regclass('public.slot_reservations')::text,
			to_regclass('public.slot_overrides')::text
	`).Scan(&slotWindows, &slotReservations, &slotOverrides); err != nil {
		log.Fatal("verification failed:", err)
	}

	var floor1TodaySlots int64
	if err := pool.QueryRow(context.Background(), `
		SELECT COUNT(*)::bigint
		FROM slot_windows
		WHERE date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
		  AND 1 BETWEEN allowed_start_floor AND allowed_end_floor
	`).Scan(&floor1TodaySlots); err != nil {
		log.Fatal("slot eligibility verification failed:", err)
	}

	fmt.Println("Migration applied: schema + students.block, students.floor_no, students.room_no(integer) columns are ready")
	fmt.Printf(
		"slot_windows=%s slot_reservations=%s slot_overrides=%s\n",
		nullableToString(slotWindows),
		nullableToString(slotReservations),
		nullableToString(slotOverrides),
	)
	fmt.Printf("today_floor1_slot_windows=%d\n", floor1TodaySlots)
}
