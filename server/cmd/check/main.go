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

	fmt.Println("🔍 Checking database status...\n")

	// Check all user types
	var studentCount, wardenCount, staffCount, totalUsers int
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&totalUsers)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM students").Scan(&studentCount)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM wardens").Scan(&wardenCount)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM laundry_staff").Scan(&staffCount)
	
	fmt.Printf("📊 Current State:\n")
	fmt.Printf("   Total users: %d\n", totalUsers)
	fmt.Printf("   Students: %d\n", studentCount)
	fmt.Printf("   Wardens: %d\n", wardenCount)
	fmt.Printf("   Laundry staff: %d\n\n", staffCount)
	
	// Show sample users if any exist
	if totalUsers > 0 {
		rows, _ := pool.Query(ctx, "SELECT email, role FROM users LIMIT 10")
		defer rows.Close()
		
		fmt.Println("📋 Sample users:")
		for rows.Next() {
			var email, role string
			rows.Scan(&email, &role)
			fmt.Printf("   %s (%s)\n", email, role)
		}
	}
	
	if studentCount >= 10 && wardenCount >= 10 && staffCount >= 10 {
		fmt.Println("\n✅ All seed data is present!")
		fmt.Println("\n📝 Login with:")
		fmt.Println("   student1@washos.com to student10@washos.com")
		fmt.Println("   warden1@washos.com to warden10@washos.com")
		fmt.Println("   laundry1@washos.com to laundry10@washos.com")
		fmt.Println("   Password: password123")
	} else {
		fmt.Println("\n⚠️  Seed data incomplete - you may need to run: go run cmd/migrate/main.go")
	}
}
