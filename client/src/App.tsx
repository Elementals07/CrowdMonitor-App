import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { LandingPage } from './pages/LandingPage';
import { UserView } from './pages/UserView';
import { Overview } from './pages/Overview';
import { LiveMonitor } from './pages/LiveMonitor';
import { Analytics } from './pages/Analytics';
import { Sessions } from './pages/Sessions';
import { Alerts } from './pages/Alerts';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public Landing & User Sensor View */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/view/:code" element={<UserView />} />

      {/* Admin Protected Dashboard */}
      <Route path="/admin" element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="live" element={<LiveMonitor />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
