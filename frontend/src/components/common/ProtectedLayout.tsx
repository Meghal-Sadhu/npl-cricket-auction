import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAuctionStore } from '../../store/auctionStore';
import { Navbar } from './Navbar';
import { UserRole } from '../../types';

export const ProtectedLayout: React.FC = () => {
  const { user, isAuthenticated, isLoading, fetchCurrentUser, token } = useAuthStore();
  const { initWebSocket } = useAuctionStore();

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (isAuthenticated && token) {
      initWebSocket(token);
    }
  }, [isAuthenticated, token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-400">Loading NPL Auction Platform...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
};

interface RoleGuardProps {
  allowedRoles: UserRole[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles }) => {
  const { user } = useAuthStore();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
