import { useEffect, useState } from 'react';
import { api } from './api';

/** Category tree from the admin API: [{id, name, active, products, subcategories: [...]}] */
export function useCategories() {
  const [categories, setCategories] = useState(null);
  useEffect(() => {
    api.get('/categories').then((d) => setCategories(d.categories)).catch(() => setCategories([]));
  }, []);
  return categories;
}
