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
)

func main() {
	_ = godotenv.Load()
	app:=fiber.New()
	app.Use(cors.New())
	app.Use(logger.New())
	dbPool:=db.NewPool()
	dbPool.Ping(context.Background())
	defer dbPool.Close()
	queries:=dbgen.New(dbPool)
	Handler := handler.NewHandler(queries)

	router.SetupAuthRoutes(app, Handler)

	app.Get("/ping", func(c fiber.Ctx) error {
		return c.SendString("pong")
	})

	app.Listen(":3001")

}