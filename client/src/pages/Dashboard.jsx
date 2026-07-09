import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { getSocket } from '../services/socket';
import { Briefcase, CheckSquare, ListTodo, Clock, Bell, ArrowRight, RefreshCw } from 'lucide-react';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/users/dashboard');
      setStats(data);
    } catch (error) {
      console.error('Error fetching dashboard statistics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  // Real-time: refresh stats whenever a task is created or updated
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const refresh = () => fetchDashboardStats();
    socket.on('task_updated', refresh);
    socket.on('task_created', refresh);

    return () => {
      socket.off('task_updated', refresh);
      socket.off('task_created', refresh);
    };
  }, [fetchDashboardStats]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const completionPercentage = stats?.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {user?.name}!</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ padding: '2px 8px', borderRadius: '12px', background: 'var(--primary)', color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>
              {user?.role}
            </span>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              {user?.role === 'Admin' ? 'Here is a summary of your system.' : 'Here is a summary of your workspace activities and tasks.'}
            </p>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={fetchDashboardStats} title="Refresh Stats">
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid-dashboard">
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--primary-glow)', color: 'var(--primary)' }}>
            <Briefcase size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats?.totalProjects || 0}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Total Projects</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <ListTodo size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats?.totalTasks || 0}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Assigned Tasks</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats?.pendingTasks || 0}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Pending Tasks</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--success-bg)', color: 'var(--success)' }}>
            <CheckSquare size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats?.completedTasks || 0}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Completed Tasks</p>
          </div>
        </div>
      </div>

      {/* Progress & Quick Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', marginBottom: '30px' }}>
        {/* Progress Bar Container */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '20px' }}>Task Completion Rate</h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Overall Progress</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}>{completionPercentage}%</span>
          </div>
          <div style={{ width: '100%', height: '12px', background: 'var(--bg-primary)', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
            <div
              style={{
                width: `${completionPercentage}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--primary) 0%, var(--success) 100%)',
                borderRadius: '6px',
                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            ></div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            You have completed {stats?.completedTasks || 0} out of your {stats?.totalTasks || 0} assigned tasks. Keep going!
          </p>
        </div>

        {/* Recent Notifications Card */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Unread Alerts ({stats?.unreadNotificationsCount || 0})</h2>
            <Link to="/notifications" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>View All</span>
              <ArrowRight size={14} />
            </Link>
          </div>
          {stats?.latestNotifications && stats.latestNotifications.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.latestNotifications.map((notif) => (
                <div key={notif._id} style={{ display: 'flex', gap: '12px', padding: '10px', borderRadius: '8px', background: notif.read ? 'transparent' : 'rgba(99, 102, 241, 0.05)', border: notif.read ? 'none' : '1px solid rgba(99, 102, 241, 0.15)' }}>
                  <Bell size={16} color="var(--primary)" style={{ marginTop: '3px', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{notif.message}</p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(notif.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No recent notifications
            </div>
          )}
        </div>

        {/* Admin Quick Links */}
        {user?.role === 'Admin' && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '20px' }}>Admin Actions</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Manage users, assign roles, and configure system settings.
            </p>
            <Link to="/users" className="btn btn-primary" style={{ display: 'inline-flex', width: '100%', justifyContent: 'center' }}>
              Go to User Management
            </Link>
          </div>
        )}
      </div>

      {/* Recently Updated Tasks Table/List */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '20px' }}>Recently Updated Tasks</h2>
        {stats?.recentlyUpdatedTasks && stats.recentlyUpdatedTasks.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '12px 16px' }}>Task Title</th>
                  <th style={{ padding: '12px 16px' }}>Project</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Priority</th>
                  <th style={{ padding: '12px 16px' }}>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentlyUpdatedTasks.map((task) => (
                  <tr key={task._id} style={{ borderBottom: '1px solid var(--card-border)', fontSize: '0.9rem' }}>
                    <th style={{ padding: '16px', fontWeight: 600 }}>
                      <Link to={`/projects/${task.project?._id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }} title="Go to project board">
                        {task.title}
                      </Link>
                    </th>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                      {task.project?.name || 'Unknown Project'}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>
                      {new Date(task.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
            No tasks assigned to you yet. Go to <Link to="/projects" style={{ color: 'var(--primary)' }}>Projects</Link> to start creating tasks.
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
