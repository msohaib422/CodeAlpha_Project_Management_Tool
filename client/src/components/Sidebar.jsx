import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LayoutDashboard, Briefcase, Bell, User, Settings, FolderKanban, Users } from 'lucide-react';
import './layout.css';

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useContext(AuthContext);

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
          {user?.role === 'Admin' && (
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
          )}
        </ul>
      </nav>

      <div className="sidebar-footer">
        {user?.profilePicture ? (
          <img
            src={user.profilePicture.startsWith('/uploads/') ? `http://localhost:5000${user.profilePicture}` : user.profilePicture}
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
    </aside>
  );
};

export default Sidebar;
