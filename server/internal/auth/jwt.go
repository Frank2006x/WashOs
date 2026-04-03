package auth

import (
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	accessTokenTTL  = 15 * time.Minute
	refreshTokenTTL = 7 * 24 * time.Hour
)

func jwtSecret() []byte {
	return []byte(os.Getenv("JWT_SECRET"))
}

var revokedTokenJTI sync.Map

type TokenType int

const (
	Access TokenType = iota
	Refresh
)

func (t TokenType) String() string {
	switch t {
	case Access:
		return "access"
	case Refresh:
		return "refresh"
	default:
		return "unknown"
	}
}

func generateSignedToken(userID string, tokenType TokenType, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"user_id":    userID,
		"token_type": tokenType.String(),
		"jti":        uuid.NewString(),
		"exp":        now.Add(ttl).Unix(),
		"iat":        now.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret())
}

func GenerateToken(userID string) (string, error) {
	return generateSignedToken(userID, Access, accessTokenTTL)
}

func GenerateTokenPair(userID string) (string, string, error) {
	accessToken, err := generateSignedToken(userID, Access, accessTokenTTL)
	if err != nil {
		return "", "", err
	}

	refreshToken, err := generateSignedToken(userID, Refresh, refreshTokenTTL)
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

func parseAndValidateToken(tokenStr string, expectedType TokenType) (string, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret(), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil || !token.Valid {
		return "", fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", fmt.Errorf("invalid token claims")
	}

	jti, ok := claims["jti"].(string)
	if !ok || jti == "" {
		return "", fmt.Errorf("invalid token jti")
	}
	if isTokenRevoked(jti) {
		return "", fmt.Errorf("token revoked")
	}

	tokenType, ok := claims["token_type"].(string)
	if !ok || tokenType != expectedType.String() {
		return "", fmt.Errorf("invalid token type")
	}

	userID, ok := claims["user_id"].(string)
	if !ok || userID == "" {
		return "", fmt.Errorf("invalid user id")
	}

	return userID, nil
}

func isTokenRevoked(jti string) bool {
	_, exists := revokedTokenJTI.Load(jti)
	return exists
}

func RevokeToken(tokenStr string) error {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret(), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil || !token.Valid {
		return fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return fmt.Errorf("invalid token claims")
	}

	jti, ok := claims["jti"].(string)
	if !ok || jti == "" {
		return fmt.Errorf("missing jti")
	}

	revokedTokenJTI.Store(jti, struct{}{})
	return nil
}

func ParseAndValidateAccessToken(tokenStr string) (string, error) {
	return parseAndValidateToken(tokenStr, Access)
}

func ParseAndValidateRefreshToken(tokenStr string) (string, error) {
	return parseAndValidateToken(tokenStr, Refresh)
}