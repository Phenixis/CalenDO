import React, { useState } from 'react';
import { X, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Event, RestaurantMenu } from '../../types';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { useMenus } from '../../hooks/useApiData';
import { MenuMealList, TYPE_BADGE_STYLES } from './menuDisplay';
import LoadingSpinner from '../UI/LoadingSpinner';

interface MenuDialogProps {
  event: Event;
  onClose: () => void;
}

// Collapsible so that on mobile - where the 3 restaurants stack vertically -
// reaching the last one doesn't require scrolling past the other two.
const RestaurantColumn: React.FC<{ restaurant: RestaurantMenu }> = ({ restaurant }) => {
  const [isOpen, setIsOpen] = useState(true);
  const day = restaurant.days[0];

  return (
    <div className="flex-1 min-w-0 border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between gap-2 p-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap text-left">
          <p className="text-sm font-semibold text-gray-900">{restaurant.restaurant_name}</p>
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              TYPE_BADGE_STYLES[restaurant.restaurant_type] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {restaurant.restaurant_type}
          </span>
        </div>
        {isOpen ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
      </button>

      {isOpen && (
        <div className="px-3 pb-3">
          <MenuMealList day={day} size="compact" />
        </div>
      )}
    </div>
  );
};

const MenuDialog: React.FC<MenuDialogProps> = ({ event, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const isoDate = event.uid.replace('menu-', '');
  const { data: menus, loading, error } = useMenus(isoDate);

  const startDate = new Date(event.start_time);
  const dateLabel = formatDate(startDate);
  const timeLabel = `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 250);
  };

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${
        isClosing ? 'fade-out' : 'fade-in'
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden ${
          isClosing ? 'slide-out' : 'slide-in'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 relative" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 hover:opacity-70 transition-opacity"
            style={{ color: '#92400E' }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <h3 className="text-xl font-bold mb-2">{event.summary}</h3>
          <div className="flex items-center text-sm gap-3 flex-wrap">
            <span>{dateLabel}</span>
            <span className="flex items-center">
              <Clock size={16} className="mr-1" />
              {timeLabel}
            </span>
          </div>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {loading && !menus ? (
            <LoadingSpinner size="medium" />
          ) : error ? (
            <p className="text-sm text-red-600">Impossible de charger les menus.</p>
          ) : !menus || menus.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun menu disponible pour cette date.</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              {menus.map(restaurant => (
                <RestaurantColumn key={restaurant.restaurant_code} restaurant={restaurant} />
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-400 text-right mt-3">
            Menus fournis par CROUStillant (api.croustillant.menu)
          </p>
        </div>
      </div>
    </div>
  );
};

export default MenuDialog;
