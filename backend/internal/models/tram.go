package models

import "time"

// TramDeparture is a single upcoming tram passing a tracked stop.
type TramDeparture struct {
	Route       string    `json:"route"`
	Destination string    `json:"destination"`
	ArrivalTime time.Time `json:"arrival_time"`
}

// TramStopDepartures groups the upcoming departures for one physical stop,
// along with the one-time walking estimate needed to reach it from campus.
type TramStopDepartures struct {
	StopName    string          `json:"stop_name"`
	WalkMinutes int             `json:"walk_minutes"`
	Departures  []TramDeparture `json:"departures"`
}
