import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMenus } from '../hooks/useApiData';
import { toLocalISODate, parseLocalDateParam, formatDate } from '../utils/dateUtils';
import { MenuMealList, TYPE_BADGE_STYLES } from '../components/Menu/menuDisplay';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import ErrorDisplay from '../components/UI/ErrorDisplay';

// Chrome-less, fullscreen kiosk display of the day's campus menus (same 3
// tracked restaurants as everywhere else in the app), meant to be one slide
// among several under /display/* on a shared screen. The date is entirely
// URL-driven via ?date=YYYY-MM-DD, defaulting to today.
const DisplayMenuPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const date = parseLocalDateParam(searchParams.get('date')) ?? new Date();
  const isoDate = toLocalISODate(date);

  const { data: menus, loading, error, refresh } = useMenus(isoDate);

  return (
    <div className="w-full h-screen flex flex-col bg-purple-50 overflow-hidden">
      <div className="px-6 py-4 shrink-0">
        <h1 className="text-2xl md:text-3xl font-semibold text-purple-900">
          Menu du jour — {formatDate(date)}
        </h1>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
        {loading && !menus ? (
          <LoadingSpinner size="large" />
        ) : error ? (
          <ErrorDisplay message="Impossible de charger les menus." onRetry={refresh} />
        ) : !menus || menus.length === 0 ? (
          <p className="text-xl text-gray-500">Aucun menu disponible pour cette date.</p>
        ) : (
          <div className="h-full grid grid-cols-1 md:grid-cols-3 gap-4">
            {menus.map(restaurant => (
              <div key={restaurant.restaurant_code} className="bg-white rounded-lg shadow-md p-5 overflow-y-auto">
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <h2 className="text-xl font-bold text-gray-900">{restaurant.restaurant_name}</h2>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      TYPE_BADGE_STYLES[restaurant.restaurant_type] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {restaurant.restaurant_type}
                  </span>
                </div>
                <MenuMealList day={restaurant.days[0]} size="large" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DisplayMenuPage;
