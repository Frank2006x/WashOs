package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env
	err := godotenv.Load()
	if err != nil {
		fmt.Printf("Warning: .env file not found: %v\n", err)
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		fmt.Println("Error: DATABASE_URL not found in .env")
		os.Exit(1)
	}

	// Connect to DB
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		fmt.Printf("Error connecting to DB: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(ctx)

	// Read SQL file
	sqlFile := "sql/apply_cycles.sql"
	content, err := os.ReadFile(sqlFile)
	if err != nil {
		fmt.Printf("Error reading SQL file %s: %v\n", sqlFile, err)
		os.Exit(1)
	}

	// Execute SQL
	fmt.Printf("🚀 Applying SQL from %s to database...\n", sqlFile)
	_, err = conn.Exec(ctx, string(content))
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			fmt.Println("Table already exists, skipping creation.")
		} else {
			fmt.Printf("Error executing SQL: %v\n", err)
			os.Exit(1)
		}
	}

	fmt.Println("✅ Cycle periods and 2026 data applied successfully!")
}
