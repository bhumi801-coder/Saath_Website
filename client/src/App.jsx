import { lazy } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { RequireAuth, RequireRole } from './components/Common.jsx';
import Home from './pages/Home.jsx';

// Secondary pages load on demand to keep the first page fast.
const Services = lazy(() => import('./pages/Services.jsx'));
const ServiceDetail = lazy(() => import('./pages/ServiceDetail.jsx'));
const Groups = lazy(() => import('./pages/Groups.jsx'));
const GroupDetail = lazy(() => import('./pages/GroupDetail.jsx'));
const NewGroup = lazy(() => import('./pages/NewGroup.jsx'));
const Bookings = lazy(() => import('./pages/Bookings.jsx'));
const Policies = lazy(() => import('./pages/Policies.jsx'));
const AuthPages = import('./pages/AuthPages.jsx');
const Login = lazy(() => AuthPages.then((m) => ({ default: m.Login })));
const Signup = lazy(() => AuthPages.then((m) => ({ default: m.Signup })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
// Service partner and admin areas
const PartnerAuth = import('./pages/PartnerAuth.jsx');
const PartnerLogin = lazy(() => PartnerAuth.then((m) => ({ default: m.PartnerLogin })));
const PartnerRegister = lazy(() => PartnerAuth.then((m) => ({ default: m.PartnerRegister })));
const PartnerDashboard = lazy(() => import('./pages/PartnerDashboard.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const AdminLogin = lazy(() => import('./pages/Admin.jsx').then((m) => ({ default: m.AdminLogin })));

function NotFound() {
  return (
    <div className="container narrow section-pad state empty">
      <h1>Page not found</h1>
      <p className="muted">The page you opened does not exist.</p>
      <Link className="btn btn-primary" to="/services">Browse services</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="services" element={<Services />} />
        <Route path="services/:slug" element={<ServiceDetail />} />
        <Route path="groups" element={<Groups />} />
        <Route path="groups/:id" element={<GroupDetail />} />
        <Route path="new" element={<RequireAuth><NewGroup /></RequireAuth>} />
        <Route path="bookings" element={<RequireAuth><Bookings /></RequireAuth>} />
        <Route path="policies" element={<Policies />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forgot-password" element={<ForgotPassword role="customer" />} />
        <Route path="partner/forgot-password" element={<ForgotPassword role="provider" />} />
        <Route path="partner" element={<PartnerDashboard />} />
        <Route path="partner/login" element={<PartnerLogin />} />
        <Route path="partner/register" element={<PartnerRegister />} />
        <Route path="admin" element={<RequireRole role="admin" loginTo="/admin/login"><Admin /></RequireRole>} />
        <Route path="admin/login" element={<AdminLogin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
