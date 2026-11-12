import React from 'react';
import './TabSwitcher.css';

const TabSwitcher = ({ games, activeTab, onTabChange }) => {
  return (
    <div className="tab-switcher-wrapper">
      <div className="tab-switcher-scroll">
        <button
          className={`tab-btn ${activeTab === '' ? 'active' : ''}`}
          onClick={() => onTabChange('')}
        >
          <span className="tab-dot"></span>
          <span>Tüm Oyunlar</span>
        </button>

        {games.map((game) => (
          <button
            key={game.id}
            className={`tab-btn ${activeTab === game.id ? 'active' : ''}`}
            onClick={() => onTabChange(game.id)}
          >
            <span className="tab-game-name">{game.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabSwitcher;
