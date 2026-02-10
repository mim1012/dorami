'use client';

import Sidebar from '@/components/admin/layout/Sidebar';
import Header from '@/components/admin/layout/Header';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute requiredRole="ADMIN">
            <div className="admin-layout flex min-h-screen bg-primary-black text-primary-text font-sans antialiased selection:bg-hot-pink selection:text-white">
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Header />
                    <main className="flex-1 lg:ml-64 p-4 md:p-6 lg:p-8 overflow-y-auto bg-primary-black relative">
                        {/* Background Ambient Glow */}
                        <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-hot-pink/5 rounded-full blur-[120px]" />
                            <div className="absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] bg-info/5 rounded-full blur-[100px]" />
                        </div>

                        <div className="relative z-10">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </ProtectedRoute>
    );
}
