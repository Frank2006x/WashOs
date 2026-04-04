package dbgen

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

// UpdateStudentBlock sets the hostel block for a student identified by user_id.
// Returns the updated Student row.
func (q *Queries) UpdateStudentBlock(ctx context.Context, userID pgtype.UUID, block string) (Student, error) {
	const sql = `
		UPDATE students
		SET block = $2, updated_at = NOW()
		WHERE user_id = $1
		RETURNING id, user_id, reg_no, name, block, floor_no, room_no, created_at, updated_at
	`
	row := q.db.QueryRow(ctx, sql, userID, block)
	var s Student
	err := row.Scan(
		&s.ID,
		&s.UserID,
		&s.RegNo,
		&s.Name,
		&s.Block,
		&s.FloorNo,
		&s.RoomNo,
		&s.CreatedAt,
		&s.UpdatedAt,
	)
	return s, err
}

// UpdateStudentResidence updates floor_no and room_no for a student identified by user_id.
// Nil values keep existing values unchanged.
func (q *Queries) UpdateStudentResidence(ctx context.Context, userID pgtype.UUID, floorNo *int32, roomNo *int32) (Student, error) {
	const sql = `
		UPDATE students
		SET floor_no = COALESCE($2, floor_no),
			room_no = COALESCE($3, room_no),
			updated_at = NOW()
		WHERE user_id = $1
		RETURNING id, user_id, reg_no, name, block, floor_no, room_no, created_at, updated_at
	`

	var floorParam pgtype.Int4
	if floorNo != nil {
		floorParam = pgtype.Int4{Int32: *floorNo, Valid: true}
	}

	var roomParam pgtype.Int4
	if roomNo != nil {
		roomParam = pgtype.Int4{Int32: *roomNo, Valid: true}
	}

	row := q.db.QueryRow(ctx, sql, userID, floorParam, roomParam)
	var s Student
	err := row.Scan(
		&s.ID,
		&s.UserID,
		&s.RegNo,
		&s.Name,
		&s.Block,
		&s.FloorNo,
		&s.RoomNo,
		&s.CreatedAt,
		&s.UpdatedAt,
	)
	return s, err
}
