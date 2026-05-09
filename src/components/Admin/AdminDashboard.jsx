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
        price_1day: '',
        price_7day: '',
        price_30day: '',
        price_lifetime: '',
        category_id: '',
        image_url: '',
        video_url: '',
        extra_images: [],
        media_urls: [],
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
            name: newProduct.name,
            description: newProduct.description,
            details: newProduct.details,
            price: parseFloat(newProduct.price_1day) || 0,
            price_1day: parseFloat(newProduct.price_1day) || 0,
            price_7day: parseFloat(newProduct.price_7day) || 0,
            price_30day: parseFloat(newProduct.price_30day) || 0,
            price_lifetime: parseFloat(newProduct.price_lifetime) || 0,
            category_id: newProduct.category_id,
            image_url: newProduct.image_url,
            video_url: newProduct.video_url,
            extra_images: newProduct.extra_images,
            is_available: newProduct.is_available
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
                console.error('SUPABASE UPDATE ERROR:', error);
                toast.error(`UPDATE FAILED: ${error.message}`);
            }
        } else {
            const { error } = await supabase
                .from('products')
                .insert([productData]);

            if (!error) {
                toast.success('ASSET DEPLOYED / EKLENDİ');
            } else {
                console.error('SUPABASE INSERT ERROR:', error);
                toast.error(`DEPLOY FAILED: ${error.message}`);
            }
        }

        setNewProduct({ name: '', description: '', details: '', price_1day: '', price_7day: '', price_30day: '', price_lifetime: '', category_id: '', image_url: '', video_url: '', extra_images: [], media_urls: [], is_available: true });
        fetchData();
    };

    const startEditing = (product) => {
        setEditingId(product.id);
        setNewProduct({
            name: product.name,
            description: product.description || '',
            details: product.details || '',
            price_1day: (product.price_1day || product.price || 0).toString(),
            price_7day: (product.price_7day || 0).toString(),
            price_30day: (product.price_30day || 0).toString(),
            price_lifetime: (product.price_lifetime || 0).toString(),
            category_id: product.category_id,
            image_url: product.image_url || '',
            video_url: product.video_url || '',
            extra_images: product.extra_images || [],
            media_urls: product.media_urls || [],
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
                                                <div className="items-detail-block">
                                                    {order.items.map((item, i) => (
                                                        <div key={i} className="order-item-row">
                                                            <span className="order-item-name">{item.name}</span>
                                                            <span className="duration-pill">{item.durationLabel || `${item.duration || 1} GÜN`}</span>
                                                            <span className="order-item-price">₺{item.price} × {item.quantity}</span>
                                                        </div>
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
                                            setNewProduct({ name: '', description: '', details: '', price_1day: '', price_7day: '', price_30day: '', price_lifetime: '', category_id: '', image_url: '', video_url: '', extra_images: [], media_urls: [], is_available: true });
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
                                    <div className="subscription-prices-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.65rem', color: '#bc13fe', display: 'block', marginBottom: '4px' }}>1 DAY PRICE (₺)</label>
                                            <input placeholder="1 GÜN" type="number" step="0.01" value={newProduct.price_1day} onChange={e => setNewProduct({ ...newProduct, price_1day: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.65rem', color: '#bc13fe', display: 'block', marginBottom: '4px' }}>7 DAY PRICE (₺)</label>
                                            <input placeholder="7 GÜN" type="number" step="0.01" value={newProduct.price_7day} onChange={e => setNewProduct({ ...newProduct, price_7day: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.65rem', color: '#bc13fe', display: 'block', marginBottom: '4px' }}>30 DAY PRICE (₺)</label>
                                            <input placeholder="30 GÜN" type="number" step="0.01" value={newProduct.price_30day} onChange={e => setNewProduct({ ...newProduct, price_30day: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.65rem', color: '#bc13fe', display: 'block', marginBottom: '4px' }}>LIFETIME (₺)</label>
                                            <input placeholder="SINIRSIZ" type="number" step="0.01" value={newProduct.price_lifetime} onChange={e => setNewProduct({ ...newProduct, price_lifetime: e.target.value })} />
                                        </div>
                                    </div>
                                    <select value={newProduct.category_id} onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })}>
                                        <option value="">SELECT SECTOR</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <input placeholder="COVER IMAGE URL (Main Display)" value={newProduct.image_url} onChange={e => setNewProduct({ ...newProduct, image_url: e.target.value })} />
                                    <input placeholder="VIDEO URL (YouTube or Direct MP4)" value={newProduct.video_url} onChange={e => setNewProduct({ ...newProduct, video_url: e.target.value })} />

                                    <div className="media-urls-section" style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid rgba(188, 19, 254, 0.4)', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.2)', boxShadow: '0 0 10px rgba(188, 19, 254, 0.1)' }}>
                                        <h4 className="cyber-font" style={{ marginBottom: '1rem', color: '#bc13fe', fontSize: '0.9rem' }}>EXTRA IMAGES</h4>
                                        {newProduct.extra_images.map((url, index) => (
                                            <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                <input
                                                    placeholder="Image URL"
                                                    value={url}
                                                    onChange={e => {
                                                        const newImages = [...newProduct.extra_images];
                                                        newImages[index] = e.target.value;
                                                        setNewProduct({ ...newProduct, extra_images: newImages });
                                                    }}
                                                    style={{ flex: 1, marginBottom: 0 }}
                                                />
                                                <button
                                                    type="button"
                                                    className="del-btn"
                                                    onClick={() => {
                                                        const newImages = newProduct.extra_images.filter((_, i) => i !== index);
                                                        setNewProduct({ ...newProduct, extra_images: newImages });
                                                    }}
                                                    style={{ padding: '0 15px' }}
                                                >×</button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            className="neon-button"
                                            style={{ padding: '0.5rem', fontSize: '0.8rem', width: 'auto', marginTop: '0.5rem', borderColor: '#bc13fe', color: '#bc13fe' }}
                                            onClick={() => setNewProduct({ ...newProduct, extra_images: [...newProduct.extra_images, ''] })}
                                        >
                                            + ADD EXTRA IMAGE
                                        </button>
                                    </div>

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
                                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>₺{p.price_1day || p.price}/gün • ₺{p.price_7day || 0}/hafta • ₺{p.price_30day || 0}/ay • ₺{p.price_lifetime || 0}/sınırsız</span>
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
