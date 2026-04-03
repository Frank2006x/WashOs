-- name: GetUserByEmail :one
SELECT *
FROM users
WHERE email = $1
LIMIT 1;

-- name: GetStudentByUserID :one
SELECT *
FROM students
WHERE user_id = $1
LIMIT 1;

-- name: GetWardenByUserID :one
SELECT *
FROM wardens
WHERE user_id = $1
LIMIT 1;

-- name: GetLaundryStaffByUserID :one
SELECT *
FROM laundry_staff
WHERE user_id = $1
LIMIT 1;
