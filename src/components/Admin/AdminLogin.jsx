import React, { useState, useEffect } from 'react'; // useEffect buraya eklendi
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Terminal } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import './AdminLogin.css';

const AdminLogin = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [lockout, setLockout] = useState(0);

    // Lockout timer effect
    useEffect(() => {
        let timer;
        if (lockout > 0) {
            timer = setInterval(() => {
                setLockout(prev => prev - 1);
            }, 1000);
        } else if (lockout === 0 && attempts >= 3) {
            setAttempts(0);
        }
        return () => clearInterval(timer);
    }, [lockout, attempts]);

    const handleSubmit = (e) => {
        e.preventDefault();

        if (lockout > 0) return;

        setIsLoading(true);
        const correctPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'Brxfear568';

        setTimeout(() => {
            if (password === correctPassword) {
                onLogin();
            } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);

                if (newAttempts >= 3) {
                    setLockout(30);
                    toast.error('LOCKOUT: BRUTE-FORCE DETECTED. 30S COOLDOWN.', {
                        style: { background: '#000', color: '#bc13fe', border: '1px solid #bc13fe' }
                    });
                } else {
                    toast.error(`DENIED. ${3 - newAttempts} ATTEMPTS REMAINING.`, {
                        style: { background: '#000', color: '#ff4444', border: '1px solid #ff4444' }
                    });
                }
                setPassword('');
            }
            setIsLoading(false);
        }, 1000);
    };

    return (
        <div className="admin-login-overlay terminal-theme">
            <Toaster position="top-center" />

            <div className="terminal-container">
                <div className="terminal-prompt">
                    <span className="prompt-text">ACCESS CODE REQUIRED:</span>
                </div>

                <form onSubmit={handleSubmit} className="terminal-form">
                    <div className="terminal-input-wrapper">
                        <input
                            type="password"
                            autoFocus
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading || lockout > 0}
                            className="terminal-input"
                        />
                        {lockout > 0 && <span className="lockout-timer">[{lockout}S]</span>}
                    </div>
                </form>

                {attempts > 0 && lockout === 0 && (
                    <div className="terminal-status warning">
                        INVALID PROTOCOL DETECTED... {attempts}/3
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminLogin;
