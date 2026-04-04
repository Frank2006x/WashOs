package handler

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
)

type cloudinaryUploadResponse struct {
	SecureURL string `json:"secure_url"`
	Error     *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func readEnvTrimmed(keys ...string) string {
	for _, key := range keys {
		value := strings.TrimSpace(os.Getenv(key))
		value = strings.Trim(value, "\"'")
		if value != "" {
			return value
		}
	}
	return ""
}

func cloudinarySignature(toSign string, apiSecret string) string {
	hash := sha1.Sum([]byte(toSign + apiSecret))
	return hex.EncodeToString(hash[:])
}

func uploadImageFileToCloudinary(ctx context.Context, fileHeader *multipart.FileHeader) (string, error) {
	cloudName := readEnvTrimmed("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_CLOUD", "CLOUD_NAME")
	apiKey := readEnvTrimmed("CLOUDINARY_API_KEY")
	apiSecret := readEnvTrimmed("CLOUDINARY_API_SECRET")

	if cloudName == "" || apiKey == "" || apiSecret == "" {
		return "", fiber.NewError(fiber.StatusInternalServerError, "cloudinary is not configured: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET")
	}
	if strings.EqualFold(cloudName, "root") {
		return "", fiber.NewError(
			fiber.StatusInternalServerError,
			"cloudinary is misconfigured: CLOUDINARY_CLOUD_NAME cannot be 'root'; use your actual cloud name from Dashboard -> Settings -> API Environment",
		)
	}
	if fileHeader == nil {
		return "", fiber.NewError(fiber.StatusBadRequest, "image file is required")
	}
	if fileHeader.Size <= 0 {
		return "", fiber.NewError(fiber.StatusBadRequest, "image file is empty")
	}
	if fileHeader.Size > 10*1024*1024 {
		return "", fiber.NewError(fiber.StatusBadRequest, "image file is too large (max 10MB)")
	}

	opened, err := fileHeader.Open()
	if err != nil {
		return "", fiber.NewError(fiber.StatusBadRequest, "failed to read image file")
	}
	defer opened.Close()

	var reqBody bytes.Buffer
	writer := multipart.NewWriter(&reqBody)

	part, err := writer.CreateFormFile("file", fileHeader.Filename)
	if err != nil {
		return "", fiber.NewError(fiber.StatusInternalServerError, "failed to prepare upload payload")
	}
	if _, err := io.Copy(part, opened); err != nil {
		return "", fiber.NewError(fiber.StatusInternalServerError, "failed to stream image payload")
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	folder := "washos/queries"
	signature := cloudinarySignature("folder="+folder+"&timestamp="+timestamp, apiSecret)

	_ = writer.WriteField("api_key", apiKey)
	_ = writer.WriteField("timestamp", timestamp)
	_ = writer.WriteField("signature", signature)
	_ = writer.WriteField("folder", folder)
	if err := writer.Close(); err != nil {
		return "", fiber.NewError(fiber.StatusInternalServerError, "failed to prepare upload payload")
	}

	uploadURL := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/upload", cloudName)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, &reqBody)
	if err != nil {
		return "", fiber.NewError(fiber.StatusInternalServerError, "failed to create upload request")
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fiber.NewError(fiber.StatusBadGateway, "failed to upload image to cloudinary")
	}
	defer resp.Body.Close()

	var uploadResp cloudinaryUploadResponse
	if err := json.NewDecoder(resp.Body).Decode(&uploadResp); err != nil {
		return "", fiber.NewError(fiber.StatusBadGateway, "invalid response from cloudinary")
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if uploadResp.Error != nil && uploadResp.Error.Message != "" {
			return "", fiber.NewError(fiber.StatusBadGateway, "cloudinary upload failed: "+uploadResp.Error.Message)
		}
		return "", fiber.NewError(fiber.StatusBadGateway, "cloudinary upload failed")
	}

	if strings.TrimSpace(uploadResp.SecureURL) == "" {
		return "", fiber.NewError(fiber.StatusBadGateway, "cloudinary did not return secure_url")
	}

	return uploadResp.SecureURL, nil
}
