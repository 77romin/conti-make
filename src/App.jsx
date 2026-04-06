import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Library from './pages/Library';
import ContiEditor from './pages/ContiEditor';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-100">
        <Navbar />
        <main>
          <Routes>
            <Route path="/"              element={<Home />} />
            <Route path="/library"       element={<Library />} />
            <Route path="/editor/:id"    element={<ContiEditor />} />
            <Route path="/settings"      element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
