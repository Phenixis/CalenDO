export interface Planning {
  id: string;
  name: string;
  description: string;
  color: string;
  created: string;
  updated: string;
  is_default: boolean;
  event_count?: number;
}

export interface Event {
  uid: string;
  planning_id: string;
  summary: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  created: string;
  last_modified: string;
  planning?: Planning;
}

export interface EventInput {
  planning_id: string;
  summary: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string;
}

export type CalendarViewType = 'month' | 'week' | 'day';

export interface SearchFilters {
  keyword: string;
  field: 'all' | 'summary' | 'description' | 'location';
}

export interface PlanningSelection {
  selectedPlannings: Planning[];
  selectAll: boolean;
}

export interface MenuDish {
  code: number;
  ordre: number;
  libelle: string;
}

export interface MenuCategory {
  code: number;
  libelle: string;
  ordre: number;
  plats: MenuDish[];
}

export interface MenuMeal {
  code: number;
  type: 'matin' | 'midi' | 'soir';
  categories: MenuCategory[];
}

export interface MenuDay {
  code: number;
  date: string; // ISO 8601 (YYYY-MM-DD)
  repas: MenuMeal[];
}

export interface RestaurantMenu {
  restaurant_code: number;
  restaurant_name: string;
  restaurant_type: string;
  days: MenuDay[];
}