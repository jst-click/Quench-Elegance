import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { adminApi, inr } from '../api';

export default function Products() {
  const [list, setList] = useState(null);
  useEffect(() => { adminApi.get('/products').then((d) => setList(d.products)).catch(() => setList([])); }, []);

  return (
    <div className="adm-page">
      <div className="adm-head"><h1>Products</h1><Link to="/admin/products/new" className="btn btn-primary btn-sm"><Plus size={16} /> Add product</Link></div>
      <div className="adm-card no-pad">
        {!list ? <div className="page-loader"><div className="spinner" /></div> : (
          <div className="table-scroll">
            <table className="adm-table">
              <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>MRP</th><th>Stock</th><th>Status</th></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/admin/products/${p.id}`} className="prod-cell">
                        {p.image ? <img src={p.image} alt="" /> : <span className="prod-ph" />}
                        <span><strong>{p.name}</strong><small>{p.subtitle}</small></span>
                      </Link>
                    </td>
                    <td>{p.category}{p.size && <div className="muted small">{p.size}</div>}</td>
                    <td className="num">{inr(p.price)}</td>
                    <td className="num muted">{inr(p.mrp)}</td>
                    <td className={p.stock <= 10 ? 'text-danger' : ''}>{p.stock}</td>
                    <td>
                      <span className={`pill ${p.active ? 'pill-on' : 'pill-off'}`}>{p.active ? 'Live' : 'Hidden'}</span>
                      {p.featured && <span className="pill pill-gold">Featured</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
