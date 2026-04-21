import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Trackers from './pages/Trackers';
import TrackerEditor from './pages/TrackerEditor';
import Actions from './pages/Actions';
import ActionEditor from './pages/ActionEditor';
import Logs from './pages/Logs';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="trackers" element={<Trackers />} />
        <Route path="trackers/new" element={<TrackerEditor mode="new" />} />
        <Route path="trackers/:id" element={<TrackerEditor mode="edit" />} />
        <Route path="actions" element={<Actions />} />
        <Route path="actions/new" element={<ActionEditor mode="new" />} />
        <Route path="actions/:id" element={<ActionEditor mode="edit" />} />
        <Route path="logs" element={<Logs />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
