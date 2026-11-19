import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './components/auth';
import Layout from './components/Layout';
import { PageLoader } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import CreateOrder from './pages/CreateOrder';
import Invoices from './pages/Invoices';
import InvoiceView from './pages/InvoiceView';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Requests from './pages/Requests';
import RequestDetail from './pages/RequestDetail';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Combos from './pages/Combos';
import ComboForm from './pages/ComboForm';
import ProductForm from './pages/ProductForm';
import Messages from './pages/Messages';
import Chats from './pages/Chats';
import Settings from './pages/Settings';

function NotFound() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-center">
      <div>
        <p className="font-display text-8xl text-brown-800/25">404</p>
        <h1 className="text-3xl">Page not found</h1>
        <Link to="/" className="btn-primary mt-6">Go to dashboard</Link>
      </div>
    </div>
  );
}

export default function App() {
  const { admin, ready } = useAuth();
  if (!ready) return <div className="grid min-h-screen place-items-center"><PageLoader /></div>;
  if (!admin) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/new" element={<CreateOrder />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/:id" element={<InvoiceView />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="requests" element={<Requests />} />
        <Route path="requests/:id" element={<RequestDetail />} />
        <Route path="products" element={<Products />} />
        <Route path="categories" element={<Categories />} />
        <Route path="combos" element={<Combos />} />
        <Route path="combos/new" element={<ComboForm />} />
        <Route path="combos/:id" element={<ComboForm />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="chats" element={<Chats />} />
        <Route path="chats/:id" element={<Chats />} />
        <Route path="messages" element={<Messages />} />
        <Route path="settings" element={<Settings />} />
        <Route path="login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
