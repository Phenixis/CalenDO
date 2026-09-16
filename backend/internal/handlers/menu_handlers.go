package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/do2024-2047/CalenDO/internal/models"
)

const (
	// croustillantAPIBaseURL is the base URL of the CROUStillant public API
	// (https://api.croustillant.menu/) which serves French CROUS restaurant menus.
	croustillantAPIBaseURL = "https://api.croustillant.menu/v1"

	// The CROUStillant API requires a custom User-Agent identifying the calling
	// application with a contact method, and browsers cannot set this header
	// from client-side fetch, so this call must be proxied through the backend.
	croustillantUserAgent = "CalenDO/1.0 (+https://github.com/DO-2K24-27/CalenDO) [Affichage des menus des restaurants universitaires de Montpellier]"

	menuCacheTTL = 30 * time.Minute

	// menuDateLayout is the ISO date format (YYYY-MM-DD) used on the wire.
	menuDateLayout = "2006-01-02"

	// maxMenuRangeDays caps how many days a single ?start/&end request can span.
	maxMenuRangeDays = 14
)

// campusParisLocation is used to determine "today" from the campus' point of
// view (Europe/Paris) rather than the server's local/UTC time.
var campusParisLocation = func() *time.Location {
	loc, err := time.LoadLocation("Europe/Paris")
	if err != nil {
		return time.UTC
	}
	return loc
}()

// menuSource describes a CROUStillant restaurant tracked by CalenDO, all on
// the Triolet science campus in Montpellier. RestaurantType is surfaced to
// the frontend so it can tell a "Resto U" full-meal restaurant apart from a
// "Cafétéria" that only offers breakfast/snack formulas.
type menuSource struct {
	code           int
	name           string
	restaurantType string
}

var trackedMenuSources = []menuSource{
	{code: 652, name: "Resto U' Triolet", restaurantType: "Resto U"},
	{code: 650, name: "Resto U' Vert-Bois", restaurantType: "Resto U"},
	{code: 656, name: "Cafet' (s)pace", restaurantType: "Cafétéria"},
}

var menuHTTPClient = &http.Client{Timeout: 10 * time.Second}

// menuCacheKey identifies a single restaurant/date pair in the cache. Unlike
// the "upcoming days" list, a per-date lookup also works for past dates,
// which is required to show a menu for days earlier in the current week.
type menuCacheKey struct {
	code int
	date string // YYYY-MM-DD
}

type menuCacheEntry struct {
	day       *models.MenuDay // nil means "confirmed no menu for this date"
	fetchedAt time.Time
}

var (
	menuCacheMu sync.Mutex
	menuCache   = map[menuCacheKey]menuCacheEntry{}
)

// upstreamMenuDayResponse mirrors the CROUStillant per-date API response
// shape: GET /restaurants/{code}/menu/{DD-MM-YYYY}.
type upstreamMenuDayResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    *struct {
		Code  int               `json:"code"`
		Date  string            `json:"date"`
		Repas []models.MenuMeal `json:"repas"`
	} `json:"data"`
}

// GetMenusHandler godoc
// @Summary Get CROUS menus for the Montpellier Triolet campus restaurants
// @Description Retrieve the (s)pace cafétéria and neighboring Resto U menus for a date or date range, via the CROUStillant API
// @Tags menu
// @Produce json
// @Param date query string false "Single ISO date (YYYY-MM-DD), defaults to today"
// @Param start query string false "Start of an inclusive ISO date range (requires end)"
// @Param end query string false "End of an inclusive ISO date range (requires start)"
// @Success 200 {array} models.RestaurantMenuResponse
// @Failure 400 {object} string "Invalid date parameters"
// @Router /api/menus [get]
func GetMenusHandler(w http.ResponseWriter, r *http.Request) {
	dates, err := resolveRequestedDates(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	menus := make([]models.RestaurantMenuResponse, 0, len(trackedMenuSources))
	for _, source := range trackedMenuSources {
		days := make([]models.MenuDay, 0, len(dates))
		for _, date := range dates {
			day, err := getMenuDay(source, date)
			if err != nil {
				log.Printf("menu: skipping %s for restaurant %d (%s): %v", date, source.code, source.name, err)
				continue
			}
			if day != nil {
				days = append(days, *day)
			}
		}

		menus = append(menus, models.RestaurantMenuResponse{
			RestaurantCode: source.code,
			RestaurantName: source.name,
			RestaurantType: source.restaurantType,
			Days:           days,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(menus)
}

// resolveRequestedDates parses ?date=YYYY-MM-DD or ?start=&end=, defaulting
// to "today" (Europe/Paris) when neither is provided.
func resolveRequestedDates(r *http.Request) ([]string, error) {
	query := r.URL.Query()
	startParam := query.Get("start")
	endParam := query.Get("end")
	dateParam := query.Get("date")

	if startParam != "" || endParam != "" {
		if startParam == "" || endParam == "" {
			return nil, fmt.Errorf("both start and end are required for a date range")
		}
		start, err := time.ParseInLocation(menuDateLayout, startParam, campusParisLocation)
		if err != nil {
			return nil, fmt.Errorf("invalid start date: %w", err)
		}
		end, err := time.ParseInLocation(menuDateLayout, endParam, campusParisLocation)
		if err != nil {
			return nil, fmt.Errorf("invalid end date: %w", err)
		}
		if end.Before(start) {
			return nil, fmt.Errorf("end must not be before start")
		}
		if end.Sub(start) > (maxMenuRangeDays-1)*24*time.Hour {
			return nil, fmt.Errorf("date range too large (max %d days)", maxMenuRangeDays)
		}

		dates := make([]string, 0, maxMenuRangeDays)
		for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
			dates = append(dates, d.Format(menuDateLayout))
		}
		return dates, nil
	}

	if dateParam != "" {
		if _, err := time.ParseInLocation(menuDateLayout, dateParam, campusParisLocation); err != nil {
			return nil, fmt.Errorf("invalid date: %w", err)
		}
		return []string{dateParam}, nil
	}

	return []string{time.Now().In(campusParisLocation).Format(menuDateLayout)}, nil
}

// getMenuDay returns the cached menu for a restaurant/date pair when still
// fresh, otherwise fetches it from CROUStillant. If the refresh fails, a
// stale cached value is served instead of dropping the day entirely.
func getMenuDay(source menuSource, date string) (*models.MenuDay, error) {
	key := menuCacheKey{code: source.code, date: date}

	menuCacheMu.Lock()
	if entry, ok := menuCache[key]; ok && time.Since(entry.fetchedAt) < menuCacheTTL {
		menuCacheMu.Unlock()
		return entry.day, nil
	}
	menuCacheMu.Unlock()

	fresh, err := fetchRestaurantMenuForDate(source, date)
	if err != nil {
		menuCacheMu.Lock()
		defer menuCacheMu.Unlock()
		if entry, ok := menuCache[key]; ok {
			log.Printf("menu: using stale cache for %s on %s, refresh failed: %v", source.name, date, err)
			return entry.day, nil
		}
		return nil, err
	}

	menuCacheMu.Lock()
	menuCache[key] = menuCacheEntry{day: fresh, fetchedAt: time.Now()}
	menuCacheMu.Unlock()
	return fresh, nil
}

// fetchRestaurantMenuForDate calls the CROUStillant per-date API for a single
// restaurant. It returns (nil, nil) when the restaurant simply has no menu
// for that date (closed, weekend, not yet published), which is not an error.
func fetchRestaurantMenuForDate(source menuSource, isoDate string) (*models.MenuDay, error) {
	parsedDate, err := time.Parse(menuDateLayout, isoDate)
	if err != nil {
		return nil, err
	}
	upstreamDate := parsedDate.Format("02-01-2006")

	url := fmt.Sprintf("%s/restaurants/%d/menu/%s", croustillantAPIBaseURL, source.code, upstreamDate)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", croustillantUserAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := menuHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// The API returns 200 with {"success": false, ...} when there's no menu
	// for that date, so only transport-level failures are treated as errors.
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("croustillant API returned status %d", resp.StatusCode)
	}

	var upstream upstreamMenuDayResponse
	if err := json.NewDecoder(resp.Body).Decode(&upstream); err != nil {
		return nil, err
	}

	if !upstream.Success || upstream.Data == nil {
		return nil, nil
	}

	return &models.MenuDay{
		Code:  upstream.Data.Code,
		Date:  isoDate,
		Repas: upstream.Data.Repas,
	}, nil
}
