import React from 'react';
import { Coffee, UtensilsCrossed, Cookie } from 'lucide-react';
import { MenuDay } from '../../types';

// eslint-disable-next-line react-refresh/only-export-components
export const MEAL_LABELS: Record<string, string> = {
  matin: 'Petit-déjeuner',
  midi: 'Déjeuner',
  soir: 'Goûter',
};

// eslint-disable-next-line react-refresh/only-export-components
export const MEAL_ICONS: Record<string, React.ReactNode> = {
  matin: <Coffee size={14} />,
  midi: <UtensilsCrossed size={14} />,
  soir: <Cookie size={14} />,
};

// Visually distinguishes the kind of establishment a menu comes from: a
// "Resto U" serves a full lunch, a "Cafétéria" only breakfast/snack formulas.
// eslint-disable-next-line react-refresh/only-export-components
export const TYPE_BADGE_STYLES: Record<string, string> = {
  'Resto U': 'bg-green-100 text-green-700',
  'Cafétéria': 'bg-amber-100 text-amber-700',
};

interface MenuMealListProps {
  day: MenuDay | undefined;
  /** "compact" for the dialog, "large" for the fullscreen kiosk display */
  size?: 'compact' | 'large';
}

export const MenuMealList: React.FC<MenuMealListProps> = ({ day, size = 'compact' }) => {
  if (!day || day.repas.length === 0) {
    return (
      <p className={size === 'large' ? 'text-xl text-gray-500' : 'text-sm text-gray-500'}>
        Pas de menu disponible.
      </p>
    );
  }

  const mealLabelClass = size === 'large' ? 'text-lg font-semibold text-purple-700' : 'text-xs font-medium text-purple-700';
  const categoryLabelClass = size === 'large'
    ? 'text-sm font-medium text-gray-500 uppercase tracking-wide'
    : 'text-[11px] font-medium text-gray-500 uppercase tracking-wide';
  const dishClass = size === 'large' ? 'text-lg text-gray-700' : 'text-sm text-gray-700';
  const iconSize = size === 'large' ? 20 : 14;

  return (
    <div className={size === 'large' ? 'space-y-5' : 'space-y-3'}>
      {day.repas.map(meal => (
        <div key={meal.code}>
          <div className={`flex items-center gap-1.5 mb-1 ${mealLabelClass}`}>
            {React.isValidElement(MEAL_ICONS[meal.type])
              ? React.cloneElement(MEAL_ICONS[meal.type] as React.ReactElement, { size: iconSize })
              : <UtensilsCrossed size={iconSize} />}
            <span>{MEAL_LABELS[meal.type] ?? meal.type}</span>
          </div>
          <div className={size === 'large' ? 'space-y-2' : 'space-y-1.5'}>
            {meal.categories.map(category => (
              <div key={category.code}>
                <p className={categoryLabelClass}>{category.libelle}</p>
                <ul className={dishClass}>
                  {category.plats.map(plat => (
                    <li key={plat.code}>{plat.libelle}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
