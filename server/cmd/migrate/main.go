package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	for _, p := range []string{".env", "../.env", "../../.env", "../../../.env"} {
		if _, err := os.Stat(p); err == nil {
			_ = godotenv.Load(p)
			break
		}
	}

	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal("connect:", err)
	}
	defer pool.Close()

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

	fmt.Println("Migration applied: students.block, students.floor_no, students.room_no(integer) columns are ready")
}
