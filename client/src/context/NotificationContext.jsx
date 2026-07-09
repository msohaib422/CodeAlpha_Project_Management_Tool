import React, { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import { initiateSocketConnection, disconnectSocket, getSocket } from '../services/socket';
import API from '../services/api';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Load notifications paginated
  const fetchNotifications = async (pageNum = 1, append = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await API.get(`/notifications?page=${pageNum}&limit=10`);
      if (append) {
        setNotifications((prev) => {
          // Avoid duplicates
          const existingIds = new Set(prev.map((n) => n._id));
          const filtered = data.notifications.filter((n) => !existingIds.has(n._id));
          return [...prev, ...filtered];
        });
      } else {
        setNotifications(data.notifications);
      }
      setUnreadCount(data.unreadCount);
      setPage(data.page);
      setPages(data.pages);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toast notifier helper
  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Mark all notifications as read or individual one
  const handleMarkAsRead = async (notificationId = null) => {
    try {
      await API.put('/notifications/read', { notificationId });
      if (notificationId) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        addToast('Notification marked as read', 'success');
      } else {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
        addToast('All notifications marked as read', 'success');
      }
    } catch (error) {
      console.error('Error marking notifications read:', error);
      addToast('Failed to mark notifications as read', 'error');
    }
  };

  useEffect(() => {
    if (user) {
      // 1. Fetch first page of notifications
      fetchNotifications(1, false);

      // 2. Establish Socket Connection
      const socket = initiateSocketConnection(user._id);

      // 3. Listen for live notifications
      socket.on('new_notification', (newNotif) => {
        setNotifications((prev) => {
          if (prev.some((n) => n._id === newNotif._id)) return prev;
          return [newNotif, ...prev];
        });
        // Eagerly increment so badge updates instantly, before unread_count_update arrives
        setUnreadCount((prev) => prev + 1);
        addToast(newNotif.message, 'info');
      });

      socket.on('unread_count_update', (data) => {
        if (data && typeof data.count === 'number') {
          setUnreadCount(data.count);
        }
      });

      return () => {
        disconnectSocket();
      };
    } else {
      setNotifications([]);
      setUnreadCount(0);
      disconnectSocket();
    }
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        page,
        pages,
        loading,
        fetchNotifications,
        markAsRead: handleMarkAsRead,
        addToast,
        removeToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
