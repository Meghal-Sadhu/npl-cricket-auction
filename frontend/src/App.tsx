import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedLayout, RoleGuard } from './components/common/ProtectedLayout';

const AuthPages = lazy(() => import('./pages/AuthPages').then(m => ({ default: m.AuthPages })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const AuctionRoomPage = lazy(() => import('./pages/AuctionRoomPage').then(m => ({ default: m.AuctionRoomPage })));
const PlayerPoolPage = lazy(() => import('./pages/PlayerPoolPage').then(m => ({ default: m.PlayerPoolPage })));
const PlayerRegisterPage = lazy(() => import('./pages/PlayerRegisterPage').then(m => ({ default: m.PlayerRegisterPage })));
const TeamsPage = lazy(() => import('./pages/TeamsPage').then(m => ({ default: m.TeamsPage })));
const MyTeamPage = lazy(() => import('./pages/MyTeamPage').then(m => ({ default: m.MyTeamPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage').then(m => ({ default: m.UserManagementPage })));

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

export const App: React.FC = () => {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
    </Router>
  );
};
