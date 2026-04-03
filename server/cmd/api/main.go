package main

import (
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3"
)

func main() {
	
	app:=fiber.New()
	app.Use(cors.New())
	app.Use(logger.New())
	app.Get("/ping", func(c fiber.Ctx) error {
		return c.SendString("pong")
	})

	app.Listen(":3000")

}