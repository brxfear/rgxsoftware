import React, { useState, useEffect } from 'react'; // useEffect buraya eklendi
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { LayoutGrid, Package, ShoppingBag, LogOut, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import './AdminDashboard.css';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('orders'); // Default to orders
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form States
    const [newCategory, setNewCategory] = useState({ name: '', slug: '', image_url: '' });
    const [editingId, setEditingId] = useState(null);
    const [newProduct, setNewProduct] = useState({
        name: '',
        description: '',
        details: '',
        price: '',
        category_id: '',
        image_url: '',
        is_available: true
    });

    useEffect(() => {
        fetchData();
        // ... (subscriptions remain same)
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [catRes, prodRes, orderRes] = await Promise.all([
            supabase.from('categories').select('*').order('name'),
            supabase.from('products').select('*').order('created_at', { ascending: false }),
            supabase.from('orders').select('*').order('created_at', { ascending: false })
        ]);

        setCategories(catRes.data || []);
        setProducts(prodRes.data || []);
        setOrders(orderRes.data || []);
        setLoading(false);
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
        fetchData();
    };

    const addCategory = async (e) => {
        e.preventDefault();
        if (!newCategory.name || !newCategory.slug) return;
        await supabase.from('categories').insert([newCategory]);
        setNewCategory({ name: '', slug: '', image_url: '' });
        fetchData();
    };

    const deleteCategory = async (id) => {
        if (confirm('Delete sector?')) {
            await supabase.from('categories').delete().eq('id', id);
            fetchData();
        }
    };

    const addProduct = async (e) => {
        e.preventDefault();

        if (!newProduct.name) {
            toast.error('NAME REQUIRED');
            return;
        }
        if (!newProduct.category_id) {
            toast.error('SELECT A SECTOR');
            return;
        }

        const productData = {
            ...newProduct,
            price: parseFloat(newProduct.price) || 0
        };

        if (editingId) {
            const { error } = await supabase
                .from('products')
                .update(productData)
                .eq('id', editingId);

            if (!error) {
                setEditingId(null);
                toast.success('CHANGES SAVED / KAYDEDİLDİ');
            } else {
                toast.error('UPDATE FAILED');
            }
        } else {
            const { error } = await supabase
                .from('products')
                .insert([productData]);

            if (!error) {
                toast.success('ASSET DEPLOYED / EKLENDİ');
            } else {
                toast.error('DEPLOY FAILED');
            }
        }

        setNewProduct({ name: '', description: '', details: '', price: '', category_id: '', image_url: '', is_available: true });
        fetchData();
    };

    const startEditing = (product) => {
        setEditingId(product.id);
        setNewProduct({
            name: product.name,
            description: product.description || '',
            details: product.details || '',
            price: product.price.toString(),
            category_id: product.category_id,
            image_url: product.image_url || '',
            is_available: product.is_available
        });
        // Scroll to form
        document.querySelector('.form-section-block')?.scrollIntoView({ behavior: 'smooth' });
    };

    const deleteProduct = async (id) => {
        if (confirm('Delete asset?')) {
            await supabase.from('products').delete().eq('id', id);
            fetchData();
        }
    };

    return (
        <div className="admin-dashboard-block">
            <Toaster position="top-right" />
            <aside className="admin-sidebar-block">
                <div className="sidebar-header-block">
                    <h2 className="cyber-font neon-text">SYS_ARK</h2>
                </div>
                <nav className="sidebar-nav-block">
                    <button
                        className={`nav-item-block ${activeView === 'orders' ? 'active' : ''}`}
                        onClick={() => setActiveView('orders')}
                    >
                        <ShoppingBag size={18} /> <span>ORDERS</span>
                    </button>
                    <button
                        className={`nav-item-block ${activeView === 'categories' ? 'active' : ''}`}
                        onClick={() => setActiveView('categories')}
                    >
                        <LayoutGrid size={18} /> <span>SECTORS</span>
                    </button>
                    <button
                        className={`nav-item-block ${activeView === 'products' ? 'active' : ''}`}
                        onClick={() => setActiveView('products')}
                    >
                        <Package size={18} /> <span>ASSETS</span>
                    </button>
                    <button className="nav-item-block exit-block" onClick={() => navigate('/')}>
                        <LogOut size={18} /> <span>EXIT</span>
                    </button>
                </nav>
            </aside>

            <main className="admin-main-block">
                <header className="admin-header-block">
                    <h1 className="cyber-font">
                        {activeView === 'orders' ? 'STREAM: LIVE_ORDERS' :
                            activeView === 'categories' ? 'DATABASE: SECTORS' : 'DATABASE: ASSETS'}
                    </h1>
                </header>

                <div className="admin-content-scroll">
                    {activeView === 'orders' && (
                        <div className="table-block">
                            <table className="admin-table-block">
                                <thead>
                                    <tr>
                                        <th>CUSTOMER</th>
                                        <th>CONTACT</th>
                                        <th>PAYLOAD</th>
                                        <th>TOTAL</th>
                                        <th>STATUS</th>
                                        <th>PROTOCOL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(order => (
                                        <tr key={order.id}>
                                            <td>
                                                <div className="cust-block">
                                                    <strong>{order.customer_name}</strong>
                                                    <small>{order.customer_email}</small>
                                                </div>
                                            </td>
                                            <td className="neon-text" style={{ fontSize: '0.7rem' }}>{order.customer_phone}</td>
                                            <td>
                                                <div className="items-mini-block">
                                                    {order.items.map((item, i) => (
                                                        <span key={i}>{item.name}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="price-col">₺{order.total_amount}</td>
                                            <td>
                                                <span className={`status-pill-block ${order.status.replace(/\s+/g, '-').toLowerCase()}`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="status-actions-block">
                                                    <button onClick={() => updateOrderStatus(order.id, 'Completed')} className="act-btn check"><CheckCircle size={16} /></button>
                                                    <button onClick={() => updateOrderStatus(order.id, 'Waiting for Confirmation')} className="act-btn clock"><Clock size={16} /></button>
                                                    <button onClick={() => updateOrderStatus(order.id, 'Canceled')} className="act-btn x"><XCircle size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeView === 'categories' && (
                        <div className="admin-grid-block">
                            <section className="form-section-block">
                                <h3 className="cyber-font">NEW SECTOR</h3>
                                <form onSubmit={addCategory} className="admin-form-block">
                                    <input placeholder="NAME" value={newCategory.name} onChange={e => setNewCategory({ ...newCategory, name: e.target.value })} />
                                    <input placeholder="SLUG" value={newCategory.slug} onChange={e => setNewCategory({ ...newCategory, slug: e.target.value })} />
                                    <input placeholder="IMAGE URL" value={newCategory.image_url} onChange={e => setNewCategory({ ...newCategory, image_url: e.target.value })} />
                                    <button className="neon-button">INITIALIZE</button>
                                </form>
                            </section>
                            <div className="item-list-block">
                                {categories.map(c => (
                                    <div key={c.id} className="list-item-block">
                                        <span>{c.name}</span>
                                        <button onClick={() => deleteCategory(c.id)} className="del-btn">×</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeView === 'products' && (
                        <div className="admin-grid-block">
                            <section className="form-section-block">
                                <div className="form-header-row">
                                    <h3 className="cyber-font">{editingId ? 'UPDATE ASSET' : 'NEW ASSET'}</h3>
                                    {editingId && (
                                        <button className="cancel-edit-btn" onClick={() => {
                                            setEditingId(null);
                                            setNewProduct({ name: '', description: '', price: '', category_id: '', image_url: '', is_available: true });
                                        }}>CANCEL</button>
                                    )}
                                </div>
                                <form onSubmit={addProduct} className="admin-form-block">
                                    <input placeholder="NAME" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
                                    <textarea
                                        placeholder="DESCRIPTION (Supports Multi-line)"
                                        className="large-area"
                                        value={newProduct.description}
                                        onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                                    />
                                    <textarea
                                        placeholder="PRODUCT DETAILS (Modal Only - Supports Multi-line)"
                                        className="large-area"
                                        value={newProduct.details}
                                        onChange={e => setNewProduct({ ...newProduct, details: e.target.value })}
                                    />
                                    <input placeholder="PRICE" type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} />
                                    <select value={newProduct.category_id} onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })}>
                                        <option value="">SELECT SECTOR</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <input placeholder="IMAGE URL" value={newProduct.image_url} onChange={e => setNewProduct({ ...newProduct, image_url: e.target.value })} />
                                    <button className="neon-button">
                                        {editingId ? 'SAVE CHANGES / KAYDET' : 'DEPLOY ASSET'}
                                    </button>
                                </form>
                            </section>
                            <div className="item-list-block">
                                {products.map(p => (
                                    <div key={p.id} className="list-item-block product-item">
                                        <div className="p-details">
                                            <strong>{p.name}</strong>
                                            <span>₺{p.price}</span>
                                        </div>
                                        <div className="item-actions">
                                            <button onClick={() => startEditing(p)} className="edit-btn">EDIT</button>
                                            <button onClick={() => deleteProduct(p.id)} className="del-btn">×</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
