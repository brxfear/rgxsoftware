import React from 'react';
import { useT } from '../../i18n';
import './TabSwitcher.css';

const TabSwitcher = ({ games, activeTab, onTabChange }) => {
  const { t } = useT();
  return (
    <div className="tab-switcher-wrapper">
      <div className="tab-switcher-scroll">
        <button
          className={`tab-btn ${activeTab === '' ? 'active' : ''}`}
          onClick={() => onTabChange('')}
        >
          <span className="tab-dot"></span>
          <span>{t('products.allGames')}</span>
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
