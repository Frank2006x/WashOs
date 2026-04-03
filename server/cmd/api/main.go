package main

import (
	"Frank2006x/washos/internal/db"
	"Frank2006x/washos/internal/handler"
	dbgen "Frank2006x/washos/internal/repository"
	"Frank2006x/washos/internal/router"
	"context"
	"log"
	"os"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	envPaths := []string{
		".env",       // when running from server/
		"../.env",    // when running from server/cmd/
		"../../.env", // when running from server/cmd/api/
	}
	for _, p := range envPaths {
		if _, err := os.Stat(p); err == nil {
			if err := godotenv.Load(p); err == nil {
				break
			}
		}
	}
	app := fiber.New()
	app.Use(cors.New())
	app.Use(logger.New())

	dbPool, err := db.NewPool(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	defer dbPool.Close()

	queries := dbgen.New(dbPool)
	Handler := handler.NewHandler(queries)

	router.SetupAuthRoutes(app, Handler)
	router.SetupStudentRoutes(app, Handler)
	router.SetupPhase2Routes(app, Handler)

	app.Get("/", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"name":    "WashOs API",
			"status":  "ok",
			"message": "Use /api/* endpoints",
		})
	})

	app.Get("/ping", func(c fiber.Ctx) error {
		return c.SendString("pong")
	})

	app.Get("/healthz", func(c fiber.Ctx) error {
		return c.SendString("ok")
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	if err := app.Listen(":" + port); err != nil {
		log.Fatal(err)
	}

}