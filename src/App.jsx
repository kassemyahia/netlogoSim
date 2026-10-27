import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import HomePage from './pages/HomePage';
import GradePage from './pages/GradePage';
import BooksPage from './pages/BooksPage';
import RegisterPage from './pages/RegisterPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="grade/:gradeSlug" element={<GradePage />} />
          <Route path="books" element={<BooksPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}