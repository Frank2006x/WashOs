package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
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

	// Check for query mode
	if len(os.Args) > 1 && os.Args[1] == "--query" {
		if len(os.Args) < 3 {
			fmt.Println("Error: --query requires a SQL string")
			os.Exit(1)
		}
		query := os.Args[2]
		rows, err := conn.Query(ctx, query)
		if err != nil {
			fmt.Printf("Error running query: %v\n", err)
			os.Exit(1)
		}
		defer rows.Close()

		for rows.Next() {
			vals, err := rows.Values()
			if err != nil {
				fmt.Printf("Error reading row: %v\n", err)
				os.Exit(1)
			}
			fmt.Println(vals...)
		}
		return
	}

	// Check for file mode
	if len(os.Args) > 1 && os.Args[1] == "--file" {
		if len(os.Args) < 3 {
			fmt.Println("Error: --file requires a SQL file path")
			os.Exit(1)
		}
		sqlFile := os.Args[2]
		if !filepath.IsAbs(sqlFile) {
			sqlFile = filepath.Clean(sqlFile)
		}
		content, err := os.ReadFile(sqlFile)
		if err != nil {
			fmt.Printf("Error reading SQL file %s: %v\n", sqlFile, err)
			os.Exit(1)
		}
		fmt.Printf("🚀 Applying SQL from %s to database...\n", sqlFile)
		if _, err := conn.Exec(ctx, string(content)); err != nil {
			fmt.Printf("Error executing SQL file: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("✅ SQL file applied successfully")
		return
	}

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
