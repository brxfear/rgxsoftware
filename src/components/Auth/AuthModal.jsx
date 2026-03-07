import React, { useState } from 'react';
import { X, Mail, Lock, User } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                toast.success('DECRYPTION SUCCESSFUL. WELCOME BACK.');
            } else {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                toast.success('REGISTRATION COMPLETE. VERIFY EMAIL TO SYNC.');
            }
            onClose();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-overlay" onClick={onClose}>
            <div className="glass-panel auth-modal" onClick={e => e.stopPropagation()}>
                <div className="auth-header">
                    <h2 className="cyber-font neon-text">{isLogin ? 'Login' : 'Register'}</h2>
                    <button onClick={onClose} className="close-btn"><X /></button>
                </div>

                <form onSubmit={handleAuth} className="auth-form">
                    <div className="input-group">
                        <Mail className="input-icon" size={18} />
                        <input
                            type="email"
                            placeholder="EMAIL_ADDRESS"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="glass-input"
                        />
                    </div>
                    <div className="input-group">
                        <Lock className="input-icon" size={18} />
                        <input
                            type="password"
                            placeholder="ENCRYPTED_KEY"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="glass-input"
                        />
                    </div>

                    <button type="submit" className="neon-button auth-submit" disabled={loading}>
                        {loading ? 'Processing...' : (isLogin ? 'Establish Link' : 'Secure Account')}
                    </button>
                </form>

                <div className="auth-footer">
                    <p onClick={() => setIsLogin(!isLogin)}>
                        {isLogin ? "No access key? Register new ID" : "Already registered? Login to sync"}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
