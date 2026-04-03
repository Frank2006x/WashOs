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

	_, err = pool.Exec(context.Background(),
		`ALTER TABLE students ADD COLUMN IF NOT EXISTS block TEXT;`)
	if err != nil {
		log.Fatal("migration failed:", err)
	}

	fmt.Println("Migration applied: students.block column is ready")
}
