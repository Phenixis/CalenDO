package models

// MenuDish represents a single line item (dish, price, formula step, ...) of a meal category
type MenuDish struct {
	Code    int    `json:"code"`
	Ordre   int    `json:"ordre"`
	Libelle string `json:"libelle"`
}

// MenuCategory groups dishes under a named category (e.g. "Formule petit-déjeuner")
type MenuCategory struct {
	Code    int        `json:"code"`
	Libelle string     `json:"libelle"`
	Ordre   int        `json:"ordre"`
	Plats   []MenuDish `json:"plats"`
}

// MenuMeal represents a meal of the day (matin, midi, soir)
type MenuMeal struct {
	Code       int            `json:"code"`
	Type       string         `json:"type"`
	Categories []MenuCategory `json:"categories"`
}

// MenuDay represents the menu for a single restaurant on a single day
type MenuDay struct {
	Code  int        `json:"code"`
	Date  string     `json:"date"` // ISO 8601 (YYYY-MM-DD)
	Repas []MenuMeal `json:"repas"`
}

// RestaurantMenuResponse is what /api/menus returns to the frontend, one per
// tracked restaurant. RestaurantType distinguishes the kind of establishment
// (e.g. "Resto U" for a full-meal restaurant vs "Cafétéria" for a
// breakfast/snack counter), since that determines what kind of menu to expect.
type RestaurantMenuResponse struct {
	RestaurantCode int       `json:"restaurant_code"`
	RestaurantName string    `json:"restaurant_name"`
	RestaurantType string    `json:"restaurant_type"`
	Days           []MenuDay `json:"days"`
}
