import React, { useEffect, useState } from 'react';
import { useTrams } from '../hooks/useApiData';
import { TramDeparture, TramStopDepartures } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import ErrorDisplay from '../components/UI/ErrorDisplay';

// TaM's official line colors (routes.txt), used for the route badge.
const ROUTE_COLORS: Record<string, string> = {
  '1': '#005CA9',
  '5': '#287431',
};

// Below this margin (once walking time is subtracted) a departure is "tight"
// rather than comfortably "feasible".
const TIGHT_MARGIN_SECONDS = 120;

type Feasibility = 'easy' | 'tight' | 'too_late';

const formatCountdown = (totalSeconds: number): string => {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// French transit-display convention, e.g. "17h12".
const formatClockTime = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}h${minutes}`;
};

const getFeasibility = (secondsUntilArrival: number, walkMinutes: number): Feasibility => {
  const margin = secondsUntilArrival - walkMinutes * 60;
  if (margin < 0) return 'too_late';
  if (margin < TIGHT_MARGIN_SECONDS) return 'tight';
  return 'easy';
};

const FEASIBILITY_STYLES: Record<Feasibility, { label: string; className: string }> = {
  easy: { label: 'Faisable', className: 'bg-green-100 text-green-700' },
  tight: { label: 'Ric-rac', className: 'bg-amber-100 text-amber-700' },
  too_late: { label: 'Trop tard', className: 'bg-gray-200 text-gray-500' },
};

const DepartureRow: React.FC<{ departure: TramDeparture; walkMinutes: number; now: Date }> = ({
  departure,
  walkMinutes,
  now,
}) => {
  const arrivalDate = new Date(departure.arrival_time);
  const secondsUntilArrival = Math.round((arrivalDate.getTime() - now.getTime()) / 1000);
  if (secondsUntilArrival <= 0) return null;

  const feasibility = getFeasibility(secondsUntilArrival, walkMinutes);
  const style = FEASIBILITY_STYLES[feasibility];

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-lg"
          style={{ backgroundColor: ROUTE_COLORS[departure.route] ?? '#6B7280' }}
        >
          {departure.route}
        </span>
        <span className="text-lg font-medium text-gray-800 truncate">{departure.destination}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${style.className}`}>{style.label}</span>
        <div className="flex flex-col items-end">
          <span className="text-2xl font-bold text-gray-900 tabular-nums leading-tight">
            {formatClockTime(arrivalDate)}
          </span>
          <span className="text-xs text-gray-400 tabular-nums leading-tight">
            dans {formatCountdown(secondsUntilArrival)}
          </span>
        </div>
      </div>
    </div>
  );
};

const StopCard: React.FC<{ stop: TramStopDepartures; now: Date }> = ({ stop, now }) => {
  const departures = stop.departures.filter(
    d => new Date(d.arrival_time).getTime() > now.getTime()
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-5 flex-1 min-w-0">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
        <h2 className="text-xl font-bold text-gray-900">{stop.stop_name}</h2>
        <span className="text-sm text-gray-500">{stop.walk_minutes} min à pied depuis Polytech</span>
      </div>
      {departures.length === 0 ? (
        <p className="text-gray-500 py-4">Aucun passage prévu pour le moment.</p>
      ) : (
        <div>
          {departures.map((departure, index) => (
            <DepartureRow key={`${departure.route}-${departure.destination}-${index}`} departure={departure} walkMinutes={stop.walk_minutes} now={now} />
          ))}
        </div>
      )}
    </div>
  );
};

// Chrome-less, fullscreen kiosk display of the next trams passing the two
// stops nearest the Triolet campus (line 1 and line 5), meant to be one
// slide among several under /display/* on a shared screen.
const DisplayTramPage: React.FC = () => {
  const { data: stops, loading, error, refresh } = useTrams();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  return (
    <div className="w-full h-screen flex flex-col bg-purple-50 overflow-hidden">
      <div className="px-6 py-4 shrink-0">
        <h1 className="text-2xl md:text-3xl font-semibold text-purple-900">Prochains trams</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
        {loading && !stops ? (
          <LoadingSpinner size="large" />
        ) : error ? (
          <ErrorDisplay message="Impossible de charger les horaires de tram." onRetry={refresh} />
        ) : !stops || stops.length === 0 ? (
          <p className="text-xl text-gray-500">Aucune donnée disponible.</p>
        ) : (
          // auto-fit adapts the column count to however many stops the
          // backend returns (see trackedTramStops), no size constant needed.
          <div className="h-full grid gap-4 items-start grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
            {stops.map(stop => (
              <StopCard key={stop.stop_name} stop={stop} now={now} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DisplayTramPage;
