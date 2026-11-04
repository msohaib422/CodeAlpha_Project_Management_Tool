import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { SERVER_ORIGIN } from '../services/api';
import { LayoutDashboard, Briefcase, Bell, User, Settings, FolderKanban, Users, LogOut } from 'lucide-react';
import './layout.css';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
    if (window.innerWidth <= 768) onClose();
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
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="logo-text">
          <FolderKanban size={24} />
          <span>CollabPM</span>
        </div>
      </div>

      <nav style={{ flex: 1 }}>
        <ul className="sidebar-menu">
          <li>
            <NavLink
              to="/"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              end
              onClick={() => window.innerWidth <= 768 && onClose()}
            >
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/projects"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => window.innerWidth <= 768 && onClose()}
            >
              <Briefcase size={20} />
              <span>Projects</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/notifications"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => window.innerWidth <= 768 && onClose()}
            >
              <Bell size={20} />
              <span>Notifications</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/profile"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => window.innerWidth <= 768 && onClose()}
            >
              <User size={20} />
              <span>Profile</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/settings"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => window.innerWidth <= 768 && onClose()}
            >
              <Settings size={20} />
              <span>Settings</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/users"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => window.innerWidth <= 768 && onClose()}
            >
              <Users size={20} />
              <span>Manage Users</span>
            </NavLink>
          </li>
        </ul>
      </nav>

      <div className="sidebar-footer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-username">@{user?.username}</span>
          </div>
        </div>
        <button className="sidebar-logout-btn" onClick={handleLogout} style={{ display: 'none' }}>
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
