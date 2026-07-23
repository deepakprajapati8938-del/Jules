import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './app-shell/AppShell';

// Eagerly loaded components for fast initial load
import NcertChat from './features/ncert-chat/NcertChat';
import PersonalChat from './features/personal-chat/PersonalChat';
import DailyAffirmation from './daily-affirmation/DailyAffirmation';
import ReflectionJournal from './features/reflection-journal/ReflectionJournal';
import Settings from './features/settings/Settings';
import SavedItems from './features/saved-items/SavedItems';
import Flashcards from './features/flashcards/Flashcards';
import DailyLog from './features/daily-log/DailyLog';
import Home from './features/home/Home';

// Lazy loaded components for heavy screens
const Dashboard = lazy(() => import('./features/dashboard/Dashboard'));
const Tests = lazy(() => import('./features/tests/Tests'));
const ConceptMap = lazy(() => import('./features/concept-map/ConceptMap'));
const HotspotReview = lazy(() => import('./features/admin/HotspotReview'));

// Loading Fallback
const LoadingScreen = () => (
  <div className="flex-1 flex items-center justify-center h-full">
    <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/affirmation" element={<DailyAffirmation />} />
        
        {/* All main app routes are wrapped in the AppShell */}
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="chat" element={<NcertChat />} />
          <Route path="chat/:sessionId" element={<NcertChat />} />
          <Route path="personal" element={<PersonalChat />} />
          <Route path="personal/:sessionId" element={<PersonalChat />} />
          <Route path="journal" element={<ReflectionJournal />} />
          <Route path="settings" element={<Settings />} />
          <Route path="saves" element={<SavedItems />} />
          <Route path="flashcards" element={<Flashcards />} />
          <Route path="daily-log" element={<DailyLog />} />
          
          {/* Lazy loaded routes */}
          <Route path="dashboard" element={<Suspense fallback={<LoadingScreen />}><Dashboard /></Suspense>} />
          <Route path="tests" element={<Suspense fallback={<LoadingScreen />}><Tests /></Suspense>} />
          <Route path="concept-map" element={<Suspense fallback={<LoadingScreen />}><ConceptMap /></Suspense>} />
          <Route path="admin/hotspots" element={<Suspense fallback={<LoadingScreen />}><HotspotReview /></Suspense>} />
          
          {/* Fallback */}
          <Route path="*" element={<div className="p-4">Under construction</div>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
