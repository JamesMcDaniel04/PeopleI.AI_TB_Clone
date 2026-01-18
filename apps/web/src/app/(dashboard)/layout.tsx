'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import {
  LayoutDashboard,
  Database,
  FileText,
  LogOut,
  Sparkles,
  Cloud,
  Shield,
  Activity,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b">
            <Link href="/dashboard" className="flex items-center">
              <Sparkles className="h-6 w-6 text-primary-600" />
              <span className="ml-2 text-lg font-bold text-gray-900">TestBox Clone</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            <NavLink href="/dashboard" icon={<LayoutDashboard className="h-5 w-5" />}>
              Dashboard
            </NavLink>
            <NavLink href="/dashboard/environments" icon={<Cloud className="h-5 w-5" />}>
              Environments
            </NavLink>
            <NavLink href="/dashboard/generate" icon={<Sparkles className="h-5 w-5" />}>
              Generate Data
            </NavLink>
            <NavLink href="/dashboard/datasets" icon={<Database className="h-5 w-5" />}>
              Datasets
            </NavLink>
            <NavLink href="/dashboard/templates" icon={<FileText className="h-5 w-5" />}>
              Templates
            </NavLink>
            {user?.role === 'admin' && (
              <div className="pt-4 mt-4 border-t space-y-1">
                <div className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Admin
                </div>
                <NavLink href="/dashboard/admin/jobs" icon={<Activity className="h-5 w-5" />}>
                  Jobs
                </NavLink>
                <NavLink href="/dashboard/admin/users" icon={<Shield className="h-5 w-5" />}>
                  Users
                </NavLink>
              </div>
            )}
          </nav>

          {/* User section */}
          <div className="p-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-600">
                    {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.firstName || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate max-w-[120px]">
                    {user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="pl-64">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100 hover:text-gray-900"
    >
      <span className="mr-3 text-gray-400">{icon}</span>
      {children}
    </Link>
  );
}
