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
		RETURNING id, user_id, reg_no, name, block, created_at, updated_at
	`
	row := q.db.QueryRow(ctx, sql, userID, block)
	var s Student
	err := row.Scan(
		&s.ID,
		&s.UserID,
		&s.RegNo,
		&s.Name,
		&s.Block,
		&s.CreatedAt,
		&s.UpdatedAt,
	)
	return s, err
}
