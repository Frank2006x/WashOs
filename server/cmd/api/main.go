package main

import (
	"Frank2006x/washos/internal/db"
	"Frank2006x/washos/internal/handler"
	dbgen "Frank2006x/washos/internal/repository"
	"Frank2006x/washos/internal/router"
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/joho/godotenv"
	"log"
	"os"
)

func main() {
	// Try loading .env from current dir, then from 1, 2 levels up
	_ = godotenv.Load()
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("../.env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("WARNING: DATABASE_URL is empty. Check your .env file placement.")
	} else {
		log.Println("DATABASE_URL loaded successfully.")
	}

	app:=fiber.New()
	app.Use(cors.New())
	app.Use(logger.New())
	
	dbPool:=db.NewPool()
	err := dbPool.Ping(context.Background())
	if err != nil {
		log.Fatal("Could not ping database:", err)
	}
	log.Println("Database connection verified (Ping successful)")
	
	defer dbPool.Close()
	queries:=dbgen.New(dbPool)
	Handler := handler.NewHandler(queries)

	router.SetupAuthRoutes(app, Handler)

	app.Get("/ping", func(c fiber.Ctx) error {
		return c.SendString("pong")
	})

	app.Listen(":3001")

}