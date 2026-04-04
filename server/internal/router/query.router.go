package router

import (
	"Frank2006x/washos/internal/auth"
	"Frank2006x/washos/internal/handler"

	"github.com/gofiber/fiber/v3"
)

func SetupQueryRoutes(app *fiber.App, h *handler.Handler) {
	apiGroup := app.Group("/api")

	studentQueryGroup := apiGroup.Group("/student/queries", auth.AuthMiddleware)
	studentQueryGroup.Post("", h.RaiseStudentQuery)
	studentQueryGroup.Get("", h.ListMyQueries)
	studentQueryGroup.Get("/:id", h.GetMyQuery)
	studentQueryGroup.Patch("/:id/rating", h.UpdateMyQueryRating)

	staffQueryGroup := apiGroup.Group("/staff/queries", auth.AuthMiddleware)
	staffQueryGroup.Get("", h.ListStaffQueries)
	staffQueryGroup.Get("/:id", h.GetStaffQuery)
	staffQueryGroup.Post("/:id/acknowledge", h.AcknowledgeQuery)
	staffQueryGroup.Post("/:id/reply", h.ReplyQuery)
	staffQueryGroup.Post("/:id/resolve", h.ResolveQuery)
	staffQueryGroup.Post("/:id/close", h.CloseQuery)
}
