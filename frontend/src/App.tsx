import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedLayout, RoleGuard } from './components/common/ProtectedLayout';
import { AuthPages } from './pages/AuthPages';
import { DashboardPage } from './pages/DashboardPage';
import { AuctionRoomPage } from './pages/AuctionRoomPage';
import { PlayerPoolPage } from './pages/PlayerPoolPage';
import { PlayerRegisterPage } from './pages/PlayerRegisterPage';
import { TeamsPage } from './pages/TeamsPage';
import { MyTeamPage } from './pages/MyTeamPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { UserManagementPage } from './pages/UserManagementPage';

export const App: React.FC = () => {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<AuthPages />} />
        <Route path="/register" element={<AuthPages />} />

        {/* Protected App Routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/players" element={<PlayerPoolPage />} />
          <Route path="/register-profile" element={<PlayerRegisterPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          
          {/* Captain & Admin Routes */}
          <Route element={<RoleGuard allowedRoles={['captain', 'admin']} />}>
            <Route path="/my-team" element={<MyTeamPage />} />
            <Route path="/auction" element={<AuctionRoomPage />} />
          </Route>

          {/* Admin Only Routes */}
          <Route element={<RoleGuard allowedRoles={['admin']} />}>
            <Route path="/users" element={<UserManagementPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>
        </Route>

        {/* Fallback Catch-All Redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
};
