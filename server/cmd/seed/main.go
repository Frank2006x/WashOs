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

func findFirstExisting(paths []string) string {
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

func main() {
	for _, p := range []string{".env", "../.env", "../../.env", "../../../.env"} {
		if _, err := os.Stat(p); err == nil {
			_ = godotenv.Load(p)
			break
		}
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL not found")
	}

	seedPath := findFirstExisting([]string{
		filepath.Join("sql", "seed.sql"),
		filepath.Join("..", "..", "sql", "seed.sql"),
		filepath.Join("..", "..", "..", "sql", "seed.sql"),
	})
	if seedPath == "" {
		log.Fatal("seed.sql not found")
	}

	seedSQL, err := os.ReadFile(seedPath)
	if err != nil {
		log.Fatalf("failed to read seed.sql: %v", err)
	}

	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	if _, err := pool.Exec(context.Background(), string(seedSQL)); err != nil {
		log.Fatalf("seed failed: %v", err)
	}

	fmt.Println("Seed applied successfully from", seedPath)
}
