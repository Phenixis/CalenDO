import { Event, RestaurantMenu } from '../types';
import { TimeRange } from './eventUtils';
import { toLocalISODate } from './dateUtils';

// Synthetic planning used only to give the fake lunch-menu event its own
// visual identity (color/name) in EventCard/EventDetail. It is never sent to
// or read from the backend.
export const MENU_PLANNING_ID = 'campus-menu';

const menuSyntheticPlanning = {
  id: MENU_PLANNING_ID,
  name: 'Menu du midi',
  description: '',
  color: '#F59E0B',
  created: '',
  updated: '',
  is_default: false
};

/**
 * Builds a client-only "fake" calendar event carrying the day's lunch menus,
 * sized to the free lunch gap computed by findLunchGap. Returns null when no
 * tracked restaurant actually serves lunch ("midi") that day, since showing
 * breakfast/snack formulas in a lunch slot would be misleading.
 */
export const buildLunchMenuEvent = (gap: TimeRange, menus: RestaurantMenu[], day: Date): Event | null => {
  const sections: string[] = [];

  for (const restaurant of menus) {
    const menuDay = restaurant.days[0];
    const midi = menuDay?.repas.find(meal => meal.type === 'midi');
    if (!midi) continue;

    sections.push(`${restaurant.restaurant_name} (${restaurant.restaurant_type})`);
    for (const category of midi.categories) {
      const dishes = category.plats.map(plat => plat.libelle).join(', ');
      sections.push(`  ${category.libelle} : ${dishes}`);
    }
    sections.push('');
  }

  if (sections.length === 0) return null;

  const isoDate = toLocalISODate(day);
  const startIso = gap.start.toISOString();
  const endIso = gap.end.toISOString();

  return {
    uid: `menu-${isoDate}`,
    planning_id: MENU_PLANNING_ID,
    summary: "🍽️ Menu du midi",
    description: sections.join('\n').trim(),
    location: 'Campus Triolet, Montpellier',
    start_time: startIso,
    end_time: endIso,
    all_day: false,
    created: startIso,
    last_modified: startIso,
    planning: menuSyntheticPlanning
  };
};
