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
	godotenv.Load()
	
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("Connection failed: %v\n", err)
	}
	defer pool.Close()

	fmt.Println("🔄 Updating all user passwords to plain text...\n")

	// Update all users to have password: password123
	result, err := pool.Exec(ctx, "UPDATE users SET password = 'password123'")
	if err != nil {
		log.Fatalf("Failed to update passwords: %v\n", err)
	}

	rowsAffected := result.RowsAffected()
	fmt.Printf("✅ Updated %d user passwords to 'password123'\n\n", rowsAffected)
	
	fmt.Println("📝 All users now have password: password123")
}
