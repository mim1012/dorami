import { redirect } from 'next/navigation';

export default function FeaturedProductsRemovedPage() {
  redirect('/admin/products');
}

