import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F9FBFC] relative overflow-x-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#1D76BC]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-1/3 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -ml-20" />

      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}