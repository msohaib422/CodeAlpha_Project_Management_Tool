import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NotificationContext } from '../context/NotificationContext';
import { Bell, CheckCircle, Clock, Mail, Check, X } from 'lucide-react';
import API from '../services/api';
import { getSocket } from '../services/socket';

const Notifications = () => {
  const {
    notifications,
    unreadCount,
    page,
    pages,
    loading,
    fetchNotifications,
    markAsRead,
  } = useContext(NotificationContext);

  const [invitations, setInvitations] = useState([]);
  const [activeTab, setActiveTab] = useState('notifications');
  const [respondingId, setRespondingId] = useState(null);

  useEffect(() => {
    fetchNotifications(1, false);
    fetchInvitations();

    const socket = getSocket();
    if (socket) {
      const handleNewNotification = (newNotif) => {
        if (newNotif.type === 'project_invitation') {
          fetchInvitations();
        }
      };
      socket.on('new_notification', handleNewNotification);
      return () => {
        socket.off('new_notification', handleNewNotification);
      };
    }
  }, []);

  const fetchInvitations = async () => {
    try {
      const { data } = await API.get('/invitations/my');
      setInvitations(data);
    } catch (err) {
      console.error('Failed to fetch invitations', err);
    }
  };

  const handleRespond = async (invitationId, status) => {
    setRespondingId(invitationId);
    try {
      await API.put(`/invitations/${invitationId}/respond`, { status });
      fetchInvitations();
      fetchNotifications(1, false);
    } catch (err) {
      console.error('Failed to respond to invitation', err);
    } finally {
      setRespondingId(null);
    }
  };

  const handleLoadMore = () => {
    if (page < pages) fetchNotifications(page + 1, true);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map((i) => i[0]).join('').substring(0, 2).toUpperCase();
  };

  const pendingInvites = invitations.filter((i) => i.status === 'Pending');

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={24} color="var(--primary)" />
            <span>Inbox</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            {unreadCount} unread · {pendingInvites.length} pending invitation{pendingInvites.length !== 1 ? 's' : ''}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary" onClick={() => markAsRead(null)}>
            <CheckCircle size={16} />
            <span>Mark All Read</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs-header" style={{ marginBottom: '24px' }}>
        <button
          className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          Notifications
          {unreadCount > 0 && (
            <span style={{ marginLeft: '6px', background: 'var(--primary)', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '0.7rem' }}>
              {unreadCount}
            </span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'invitations' ? 'active' : ''}`}
          onClick={() => setActiveTab('invitations')}
        >
          Project Invitations
          {pendingInvites.length > 0 && (
            <span style={{ marginLeft: '6px', background: '#f59e0b', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '0.7rem' }}>
              {pendingInvites.length}
            </span>
          )}
        </button>
      </div>

      {/* NOTIFICATIONS TAB */}
      {activeTab === 'notifications' && (
        <div style={{ maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.length > 0 ? (
            <>
              {notifications.map((notif) => (
                <div
                  key={notif._id}
                  className="glass-panel"
                  style={{
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                    borderLeft: notif.read ? '1px solid var(--card-border)' : '4px solid var(--primary)',
                    background: notif.read ? 'var(--card-bg)' : 'rgba(99, 102, 241, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px' }}>
                    <div className="avatar" style={{ width: '34px', height: '34px', fontSize: '0.8rem', flexShrink: 0, background: notif.read ? 'var(--bg-tertiary)' : 'var(--primary)', color: '#fff' }}>
                      {notif.sender?.name ? getInitials(notif.sender.name) : 'S'}
                    </div>
                    <div>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{notif.message}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          {new Date(notif.createdAt).toLocaleString()}
                        </span>
                        {notif.project && (
                          <Link 
                            to={`/projects/${notif.project._id}`} 
                            style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
                            onClick={() => {
                              if (!notif.read) {
                                markAsRead(notif._id);
                              }
                            }}
                          >
                            View Project
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                  {!notif.read && (
                    <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }} onClick={() => markAsRead(notif._id)}>
                      Mark read
                    </button>
                  )}
                </div>
              ))}
              {page < pages && (
                <button className="btn btn-secondary" style={{ alignSelf: 'center', marginTop: '8px' }} onClick={handleLoadMore} disabled={loading}>
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              )}
            </>
          ) : (
            <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Bell size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '8px' }}>All Caught Up!</h3>
              <p>No notifications yet.</p>
            </div>
          )}
        </div>
      )}

      {/* INVITATIONS TAB */}
      {activeTab === 'invitations' && (
        <div style={{ maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {pendingInvites.length > 0 ? (
            pendingInvites.map((inv) => (
              <div key={inv._id} className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '14px' }}>
                    <div className="avatar" style={{ width: '40px', height: '40px', fontSize: '0.9rem', flexShrink: 0, background: '#f59e0b' }}>
                      {getInitials(inv.inviter?.name)}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        {inv.inviter?.name} invited you to join
                      </p>
                      <p style={{ fontSize: '1rem', color: 'var(--primary)', fontWeight: 700, margin: '4px 0' }}>
                        {inv.project?.name}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                        <span style={{ fontSize: '0.78rem', padding: '2px 10px', borderRadius: '12px', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', fontWeight: 600 }}>
                          Project Role: {inv.projectRole}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={11} />
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                    <button
                      className="btn btn-primary"
                      style={{ padding: '7px 16px', fontSize: '0.85rem' }}
                      onClick={() => handleRespond(inv._id, 'Accepted')}
                      disabled={respondingId === inv._id}
                    >
                      <Check size={15} />
                      <span>Accept</span>
                    </button>
                    <button
                      className="btn"
                      style={{ padding: '7px 14px', fontSize: '0.85rem', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}
                      onClick={() => handleRespond(inv._id, 'Rejected')}
                      disabled={respondingId === inv._id}
                    >
                      <X size={15} />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Mail size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '8px' }}>No Pending Invitations</h3>
              <p>You have no project invitations at the moment.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
