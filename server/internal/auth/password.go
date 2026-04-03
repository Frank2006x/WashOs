package auth

import "golang.org/x/crypto/bcrypt"

func HashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

func VerifyPassword(storedPassword, plainPassword string) bool {
	// Backward compatibility: allow legacy plain-text users until they are reset.
	if storedPassword == plainPassword {
		return true
	}
	return bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(plainPassword)) == nil
}
