import React, { useContext, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { NotificationContext } from '../context/NotificationContext';
import { SERVER_ORIGIN } from '../services/api';
import { Search, Bell, Sun, Moon, LogOut, User as UserIcon, Menu, FolderKanban } from 'lucide-react';
import './layout.css';

const Navbar = ({ onMenuClick }) => {
  const { user, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { unreadCount } = useContext(NotificationContext);
  const [searchVal, setSearchVal] = useState('');
  const navigate = useNavigate();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/projects?search=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2);
  };

  return (
    <nav className="navbar glass-panel">
      {/* Mobile Toggle Button */}
      <button className="nav-icon-btn d-md-none" onClick={onMenuClick} style={{ display: 'none' /* Will be overridden by CSS .d-md-none */ }}>
        <Menu size={20} />
      </button>

      <div className="navbar-left">
        <Link to="/" className="mobile-brand" style={{ textDecoration: 'none', color: 'var(--primary)', display: 'none', alignItems: 'center', gap: '8px', marginLeft: '-4px' }}>
          <FolderKanban size={24} />
          <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>CollabPM</span>
        </Link>
        <form className="navbar-search-form" onSubmit={handleSearchSubmit} style={{ flex: 1 }}>
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search projects..."
              className="search-input"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
            />
          </div>
        </form>
      </div>

      <div className="navbar-right">
        {/* Theme Toggle */}
        <button className="nav-icon-btn" onClick={toggleTheme} title="Toggle Theme">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notifications Icon */}
        <Link to="/notifications" className="nav-icon-btn" title="Notifications">
          <Bell size={20} />
          {unreadCount > 0 && <span className="badge-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </Link>

        {/* Profile Avatar / Logout Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/profile" style={{ textDecoration: 'none' }} title="Profile Settings">
            {user?.profilePicture ? (
              <img
                src={user.profilePicture.startsWith('/uploads/') ? `${SERVER_ORIGIN}${user.profilePicture}` : user.profilePicture}
                alt={user.name}
                className="avatar"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div className="avatar" style={{ display: user?.profilePicture ? 'none' : 'flex' }}>
              {getInitials(user?.name)}
            </div>
          </Link>

          <button className="nav-icon-btn nav-logout-desktop" onClick={logout} title="Log Out">
            <LogOut size={20} color="var(--error)" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
