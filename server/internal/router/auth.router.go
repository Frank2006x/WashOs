package router

import (
	"Frank2006x/washos/internal/handler"

	"github.com/gofiber/fiber/v3"
)

func SetupAuthRoutes(app *fiber.App, h *handler.Handler) {
	apiGroup := app.Group("/api")
	authGroup := apiGroup.Group("/auth")
	authGroup.Post("/login", h.Login)
<<<<<<< HEAD
	authGroup.Post("/logout", h.Logout)
}
=======
	authGroup.Post("/refresh", h.Refresh)
}
>>>>>>> d717255de7cbf333cba991d9de581fba59498d1e
