package main

import (
	"fmt"
	"math"
	"time"
)

type Cycle struct {
	ID        string
	Year      int
	Month     int
	Part      int
	StartDate string
	EndDate   string
	Slots     []Slot
}

type Slot struct {
	Date       string
	StartFloor int
	EndFloor   int
}

func main() {
	year := 2026
	var cycles []Cycle

	for month := 1; month <= 12; month++ {
		// Get all working days (non-Sundays) for the month
		workingDays := getWorkingDays(year, month)
		n := len(workingDays)
		if n == 0 {
			continue
		}

		// Divide month into 4 parts
		x := n % 4
		D := int(math.Ceil(float64(n) / 4.0))
		d := int(math.Floor(float64(n) / 4.0))

		currentDayIdx := 0
		for part := 1; part <= 4; part++ {
			daysInPart := d
			if part <= x {
				daysInPart = D
			} else if x == 0 {
				daysInPart = D
			}

			start := workingDays[currentDayIdx]
			end := workingDays[currentDayIdx+daysInPart-1]

			cycle := Cycle{
				ID:        fmt.Sprintf("cycle-%d-%d-%d", year, month, part),
				Year:      year,
				Month:     month,
				Part:      part,
				StartDate: start.Format("2006-01-02"),
				EndDate:   end.Format("2006-01-02"),
			}

			// Assign 16 floors across the days of this part
			// N = daysInPart
			// xf = 16 % N (days with floor count F)
			// F = ceil(16/N), f = floor(16/N)
			xf := 16 % daysInPart
			F := int(math.Ceil(16.0 / float64(daysInPart)))
			f := int(math.Floor(16.0 / float64(daysInPart)))

			currentFloor := 1
			for i := 0; i < daysInPart; i++ {
				numFloors := f
				if i < xf {
					numFloors = F
				} else if xf == 0 {
					numFloors = F
				}

				endFloor := currentFloor + numFloors - 1
				if endFloor > 16 {
					endFloor = 16
				}
				if i == daysInPart-1 {
					endFloor = 16 // ensure we hit all 16 floors
				}

				cycle.Slots = append(cycle.Slots, Slot{
					Date:       workingDays[currentDayIdx+i].Format("2006-01-02"),
					StartFloor: currentFloor,
					EndFloor:   endFloor,
				})
				currentFloor = endFloor + 1
			}

			cycles = append(cycles, cycle)
			currentDayIdx += daysInPart
		}
	}

	fmt.Println("-- Monthly Cycle Periods and Daily Floor Slots for 2026")
	fmt.Println("BEGIN;")

	fmt.Println("-- Ensure tables exist")
	fmt.Println("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")
	fmt.Println("CREATE TABLE IF NOT EXISTS laundry_cycle_periods (")
	fmt.Println("  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),")
	fmt.Println("  year INT NOT NULL,")
	fmt.Println("  month INT NOT NULL,")
	fmt.Println("  part INT NOT NULL CHECK (part BETWEEN 1 AND 4),")
	fmt.Println("  start_date DATE NOT NULL,")
	fmt.Println("  end_date DATE NOT NULL,")
	fmt.Println("  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),")
	fmt.Println("  UNIQUE (year, month, part)")
	fmt.Println(");")

	fmt.Println("CREATE TABLE IF NOT EXISTS laundry_daily_slots (")
	fmt.Println("  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),")
	fmt.Println("  cycle_id UUID NOT NULL REFERENCES laundry_cycle_periods(id) ON DELETE CASCADE,")
	fmt.Println("  date DATE NOT NULL UNIQUE,")
	fmt.Println("  start_floor INT NOT NULL,")
	fmt.Println("  end_floor INT NOT NULL,")
	fmt.Println("  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")
	fmt.Println(");")

	fmt.Println("TRUNCATE laundry_daily_slots, laundry_cycle_periods CASCADE;")

	for _, c := range cycles {
		fmt.Printf("WITH inserted_cycle AS (\n")
		fmt.Printf("  INSERT INTO laundry_cycle_periods (year, month, part, start_date, end_date)\n")
		fmt.Printf("  VALUES (%d, %d, %d, '%s', '%s')\n", c.Year, c.Month, c.Part, c.StartDate, c.EndDate)
		fmt.Printf("  RETURNING id\n")
		fmt.Printf(")\n")
		fmt.Printf("INSERT INTO laundry_daily_slots (cycle_id, date, start_floor, end_floor)\n")
		fmt.Printf("SELECT id, d.date, d.sf, d.ef FROM inserted_cycle, (\n")
		fmt.Printf("  VALUES\n")
		for i, s := range c.Slots {
			comma := ","
			if i == len(c.Slots)-1 {
				comma = ""
			}
			fmt.Printf("    (DATE '%s', %d, %d)%s\n", s.Date, s.StartFloor, s.EndFloor, comma)
		}
		fmt.Printf(") AS d(date, sf, ef);\n\n")
	}
	fmt.Println("COMMIT;")
}

func getWorkingDays(year, month int) []time.Time {
	var days []time.Time
	t := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	for t.Month() == time.Month(month) {
		if t.Weekday() != time.Sunday {
			days = append(days, t)
		}
		t = t.AddDate(0, 0, 1)
	}
	return days
}
