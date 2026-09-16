import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import CalendarPage from './pages/CalendarPage';
import CountdownPage from './pages/CountdownPage';
import DisplayMenuPage from './pages/DisplayMenuPage';
import PWAPrompt from './components/PWA/PWAPrompt';
import { CalendarProvider } from './contexts/CalendarContext';

function App() {
  return (
    <Router>
      <CalendarProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<CalendarPage />} />
            <Route path="countdown" element={<CountdownPage />} />
            <Route path="display/menu" element={<DisplayMenuPage />} />
          </Route>
        </Routes>
        <PWAPrompt />
      </CalendarProvider>
    </Router>
  );
}

export default App;