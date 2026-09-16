package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"sort"
	"sync"
	"time"

	gtfsrt "github.com/MobilityData/gtfs-realtime-bindings/golang/gtfs"
	"github.com/do2024-2047/CalenDO/internal/models"
	"google.golang.org/protobuf/proto"
)

const (
	// tramTripUpdateURL is TaM's official GTFS-RT feed (real-time predictions
	// for the whole network, urban and suburban, tram and bus alike).
	tramTripUpdateURL = "https://gtfsproxy.e-tam.fr/COMMON/TripUpdate.pb"

	tramCacheTTL         = 20 * time.Second
	maxDeparturesPerStop = 8
	tramFetchHTTPTimeout = 10 * time.Second
)

// tramStopTarget is one physical platform to watch: a stop_id/route_id pair
// from TaM's GTFS feed, plus the fixed destination shown for trips passing
// through it (each platform only ever serves one direction).
//
// Both stop_id sets and their route_id were confirmed by inspecting the live
// GTFS-RT feed directly, since the same "Pôle Chimie Balard" location also
// has bus route 13 stop_ids (13133/13233) that must NOT be mixed in with the
// tram line 5 platforms (45106/45215).
type tramStopTarget struct {
	stopID      string
	routeID     string
	destination string
}

type tramTrackedStop struct {
	name string
	// walkMinutes is a one-time walking-time estimate from the Polytech
	// Montpellier building (Triolet campus) to this stop, looked up once via
	// OSM foot-routing (routing.openstreetmap.de/routed-foot) rather than
	// calling a routing API on every request. Update it by hand if campus
	// buildings or the stop entrances change.
	walkMinutes int
	targets     []tramStopTarget
}

// trackedTramStops is the single place to edit to add, remove, or change a
// watched stop: the API response, caching, and the frontend's layout (a CSS
// grid that lays out however many stops come back) all adapt automatically.
var trackedTramStops = []tramTrackedStop{
	{
		name:        "Université Montpellier - Triolet",
		walkMinutes: 7, // ~499m, https://routing.openstreetmap.de/routed-foot
		targets: []tramStopTarget{
			{stopID: "41119", routeID: "1", destination: "Gare Sud de France"},
			{stopID: "41237", routeID: "1", destination: "Mosson"},
		},
	},
	{
		name:        "Pôle Chimie Balard",
		walkMinutes: 9, // ~682m, https://routing.openstreetmap.de/routed-foot
		targets: []tramStopTarget{
			{stopID: "45215", routeID: "5", destination: "Clapiers"},
			{stopID: "45106", routeID: "5", destination: "Grès de Montpellier"},
		},
	},
}

var tramHTTPClient = &http.Client{Timeout: tramFetchHTTPTimeout}

var (
	tramCacheMu      sync.Mutex
	tramCache        []models.TramStopDepartures
	tramCacheFetched time.Time
)

// GetTramHandler godoc
// @Summary Get upcoming tram departures near the Triolet campus
// @Description Real-time next departures for tram line 1 (Université Montpellier - Triolet) and line 5 (Pôle Chimie Balard), via TaM's GTFS-RT feed
// @Tags tram
// @Produce json
// @Success 200 {array} models.TramStopDepartures
// @Failure 502 {object} string "Upstream TaM feed unavailable"
// @Router /api/tram [get]
func GetTramHandler(w http.ResponseWriter, r *http.Request) {
	stops, err := getTramDepartures()
	if err != nil {
		http.Error(w, "tram data temporarily unavailable", http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(stops)
}

// getTramDepartures serves the cached departures when still fresh, otherwise
// refetches TaM's feed. A failed refresh falls back to a stale cache rather
// than dropping the display entirely.
func getTramDepartures() ([]models.TramStopDepartures, error) {
	tramCacheMu.Lock()
	if tramCache != nil && time.Since(tramCacheFetched) < tramCacheTTL {
		defer tramCacheMu.Unlock()
		return tramCache, nil
	}
	tramCacheMu.Unlock()

	fresh, err := fetchTramDepartures()
	if err != nil {
		tramCacheMu.Lock()
		defer tramCacheMu.Unlock()
		if tramCache != nil {
			return tramCache, nil
		}
		return nil, err
	}

	tramCacheMu.Lock()
	tramCache = fresh
	tramCacheFetched = time.Now()
	tramCacheMu.Unlock()
	return fresh, nil
}

// fetchTramDepartures downloads and parses TaM's GTFS-RT TripUpdate feed and
// extracts the next departures for every tracked stop/route pair.
func fetchTramDepartures() ([]models.TramStopDepartures, error) {
	req, err := http.NewRequest(http.MethodGet, tramTripUpdateURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := tramHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	feed := &gtfsrt.FeedMessage{}
	if err := proto.Unmarshal(body, feed); err != nil {
		return nil, err
	}

	// index target stop_ids -> which tracked stop/target they belong to, for
	// an O(1) lookup while scanning every StopTimeUpdate in the feed.
	type targetRef struct {
		stopIndex int
		target    tramStopTarget
	}
	targetsByStopID := make(map[string]targetRef, 4)
	for i, stop := range trackedTramStops {
		for _, target := range stop.targets {
			targetsByStopID[target.stopID] = targetRef{stopIndex: i, target: target}
		}
	}

	now := time.Now()
	departuresByStop := make([][]models.TramDeparture, len(trackedTramStops))

	for _, entity := range feed.GetEntity() {
		tripUpdate := entity.GetTripUpdate()
		if tripUpdate == nil {
			continue
		}
		routeID := tripUpdate.GetTrip().GetRouteId()

		for _, stopTimeUpdate := range tripUpdate.GetStopTimeUpdate() {
			ref, ok := targetsByStopID[stopTimeUpdate.GetStopId()]
			if !ok || ref.target.routeID != routeID {
				continue
			}

			arrivalTime := stopTimeUpdate.GetArrival().GetTime()
			if arrivalTime == 0 {
				arrivalTime = stopTimeUpdate.GetDeparture().GetTime()
			}
			if arrivalTime == 0 {
				continue
			}

			at := time.Unix(arrivalTime, 0)
			if at.Before(now) {
				continue
			}

			departuresByStop[ref.stopIndex] = append(departuresByStop[ref.stopIndex], models.TramDeparture{
				Route:       routeID,
				Destination: ref.target.destination,
				ArrivalTime: at,
			})
		}
	}

	result := make([]models.TramStopDepartures, 0, len(trackedTramStops))
	for i, stop := range trackedTramStops {
		departures := departuresByStop[i]
		sort.Slice(departures, func(a, b int) bool {
			return departures[a].ArrivalTime.Before(departures[b].ArrivalTime)
		})
		if len(departures) > maxDeparturesPerStop {
			departures = departures[:maxDeparturesPerStop]
		}

		result = append(result, models.TramStopDepartures{
			StopName:    stop.name,
			WalkMinutes: stop.walkMinutes,
			Departures:  departures,
		})
	}

	return result, nil
}
