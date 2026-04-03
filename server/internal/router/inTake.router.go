package router

import (
	"Frank2006x/washos/internal/auth"
	"Frank2006x/washos/internal/handler"

	"github.com/gofiber/fiber/v3"
)

func SetupPhase2Routes(app *fiber.App, h *handler.Handler) {
	apiGroup := app.Group("/api")

	scheduleGroup := apiGroup.Group("/schedules", auth.AuthMiddleware)
	scheduleGroup.Get("/my", h.GetMySchedule)

	bagGroup := apiGroup.Group("/bags", auth.AuthMiddleware)
	bagGroup.Get("/qr/:qrCode", h.GetBagByQRPrecheck)

	scanGroup := apiGroup.Group("/scan", auth.AuthMiddleware)
	scanGroup.Post("/intake", h.IntakeScan)
}
