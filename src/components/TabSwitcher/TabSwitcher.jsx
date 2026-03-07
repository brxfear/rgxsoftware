import React from 'react';
import './TabSwitcher.css';

const TabSwitcher = ({ games, activeTab, onTabChange }) => {
    return (
        <div className="tab-switcher-container">
            <div className="tab-switcher glass-panel">
                {games.map((game) => (
                    <button
                        key={game.id}
                        className={`tab-item cyber-font ${activeTab === game.id ? 'active' : ''}`}
                        onClick={() => onTabChange(game.id)}
                    >
                        {game.name}
                        {activeTab === game.id && <div className="tab-glow"></div>}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default TabSwitcher;
