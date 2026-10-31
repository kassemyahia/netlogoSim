import { HashRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import HomePage from './pages/HomePage';
import GradePage from './pages/GradePage';
import BooksPage from './pages/BooksPage';
import GradeBooksPage from './pages/GradeBooksPage';
import RegisterPage from './pages/RegisterPage';

export default function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="grade/:gradeSlug" element={<GradePage />} />
          <Route path="books" element={<BooksPage />} />
          <Route path="books/:gradeSlug" element={<GradeBooksPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
