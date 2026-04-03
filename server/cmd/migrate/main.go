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
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found")
	}

	// Get DATABASE_URL from environment
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	// Connect to database
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer pool.Close()

	fmt.Println("🔌 Connected to Neon PostgreSQL database")

	// Read and execute schema.sql
	fmt.Println("📋 Running schema migrations...")
	schemaSQL, err := os.ReadFile("sql/schema.sql")
	if err != nil {
		log.Fatalf("Failed to read schema.sql: %v\n", err)
	}

	if _, err := pool.Exec(ctx, string(schemaSQL)); err != nil {
		log.Fatalf("Failed to execute schema.sql: %v\n", err)
	}
	fmt.Println("✅ Schema migrations completed successfully")

	// Check if seed data is needed
	var existingUsers int
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE email LIKE '%@washos.com'").Scan(&existingUsers)
	
	if existingUsers >= 30 {
		fmt.Printf("✅ Database already has %d WashOs users - skipping seed\n", existingUsers)
	} else {
		// Read and execute seed.sql
		fmt.Println("🌱 Running seed data...")
		seedSQL, err := os.ReadFile("sql/seed.sql")
		if err != nil {
			log.Fatalf("Failed to read seed.sql: %v\n", err)
		}

		if _, err := pool.Exec(ctx, string(seedSQL)); err != nil {
			log.Printf("⚠️  Some seed data may already exist (this is OK): %v\n", err)
		} else {
			fmt.Println("✅ Seed data inserted successfully")
		}
	}

	// Verify the data
	fmt.Println("\n📊 Verification:")
	
	var studentCount, wardenCount, staffCount, totalUsers int
	
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM students").Scan(&studentCount)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM wardens").Scan(&wardenCount)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM laundry_staff").Scan(&staffCount)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&totalUsers)
	
	fmt.Printf("   Students created: %d\n", studentCount)
	fmt.Printf("   Wardens created: %d\n", wardenCount)
	fmt.Printf("   Laundry staff created: %d\n", staffCount)
	fmt.Printf("   Total users created: %d\n", totalUsers)
	
	fmt.Println("\n🎉 Database setup complete!")
	fmt.Println("\n📝 Login credentials:")
	fmt.Println("   Students: student1@washos.com to student10@washos.com")
	fmt.Println("   Wardens: warden1@washos.com to warden10@washos.com")
	fmt.Println("   Laundry Staff: laundry1@washos.com to laundry10@washos.com")
	fmt.Println("   Password for all: password123")
}
