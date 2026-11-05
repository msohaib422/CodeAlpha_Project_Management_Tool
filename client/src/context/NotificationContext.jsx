import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from './AuthContext';
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

  const seenIdsRef = useRef(new Set());

  // Load notifications paginated
  const fetchNotifications = async (pageNum = 1, append = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await API.get(`/notifications?page=${pageNum}&limit=10`);
      if (append) {
        setNotifications((prev) => {
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
      // Track seen ids so polling can detect genuinely new notifications.
      data.notifications.forEach((n) => seenIdsRef.current.add(n._id));
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
    // Prevent duplicate count updates: only decrement if the notification was unread.
    let wasUnread = true;
    if (notificationId) {
      const target = notifications.find((n) => n._id === notificationId);
      if (target) wasUnread = !target.read;
    }
    try {
      await API.put('/notifications/read', { notificationId });
      if (notificationId) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
        );
        if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
      } else {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking notifications read:', error);
      addToast('Failed to mark notifications as read', 'error');
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      seenIdsRef.current = new Set();
      return;
    }

    // Initial load
    fetchNotifications(1, false);

    // Poll for new notifications / unread count updates
    const poll = async () => {
      try {
        const { data } = await API.get('/notifications?page=1&limit=10');
        let hasNew = false;
        data.notifications.forEach((n) => {
          if (!seenIdsRef.current.has(n._id)) {
            seenIdsRef.current.add(n._id);
            hasNew = true;
            addToast(n.message, 'info');
          }
        });
        setUnreadCount(data.unreadCount);
        // Merge: prepend genuinely new notifications, update existing ones in place
        setNotifications((prev) => {
          const byId = new Map(prev.map((n) => [n._id, n]));
          const newOnes = [];
          data.notifications.forEach((n) => {
            if (!byId.has(n._id)) {
              newOnes.push(n);
            } else {
              byId.set(n._id, n);
            }
          });
          const updatedExisting = prev.map((p) => byId.get(p._id) || p);
          return [...newOnes, ...updatedExisting.filter((p) => !newOnes.some((n) => n._id === p._id))];
        });
        setPage(data.page);
        setPages(data.pages);
      } catch (error) {
        console.error('Error polling notifications:', error);
      }
    };

    const intervalId = setInterval(poll, 20000);
    return () => clearInterval(intervalId);
  }, [user?._id]);

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