import React, { useState, useEffect, useContext } from 'react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import Modal from './Modal';
import { User, Calendar, AlertCircle, Tag, Send, Trash2, Edit2, Check, X, MessageSquare, Clock } from 'lucide-react';

const TaskDetailsModal = ({ isOpen, onClose, task, projectMembers, assignableMembers, canManage, onTaskUpdated, onTaskDeleted }) => {
  const { user } = useContext(AuthContext);
  const { addToast } = useContext(NotificationContext);

  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [tags, setTags] = useState('');
  
  // Comment Editing
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  // Initialize fields
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'medium');
      setStatus(task.status || 'todo');
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
      setAssignedTo(task.assignedTo?._id || 'unassigned');
      setTags(task.tags ? task.tags.join(', ') : '');
      fetchComments();
      setIsEditing(false);
    }
  }, [task]);

  const fetchComments = async () => {
    if (!task) return;
    setCommentsLoading(true);
    try {
      const { data } = await API.get(`/comments?taskId=${task._id}`);
      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleFieldChange = async (fieldName, value) => {
    // Optimistic local change or direct update
    try {
      const payload = {
        [fieldName]: value === 'unassigned' ? 'unassigned' : value,
      };
      const { data } = await API.put(`/tasks/${task._id}`, payload);
      onTaskUpdated(data);
      addToast('Task updated successfully', 'success');
    } catch (error) {
      console.error('Error updating task field:', error);
      addToast('Failed to update task', 'error');
    }
  };

  const handleSaveAll = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      addToast('Task title is required', 'error');
      return;
    }

    setLoading(true);
    try {
      const formattedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const payload = {
        title,
        description,
        priority,
        status,
        dueDate: dueDate || null,
        assignedTo,
        tags: formattedTags,
      };

      const { data } = await API.put(`/tasks/${task._id}`, payload);
      onTaskUpdated(data);
      setIsEditing(false);
      addToast('Task details saved', 'success');
    } catch (error) {
      console.error('Error saving task details:', error);
      addToast('Failed to save task details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      await API.delete(`/tasks/${task._id}`);
      onTaskDeleted(task._id);
      onClose();
      addToast('Task deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting task:', error);
      addToast('Failed to delete task', 'error');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const { data } = await API.post('/comments', { taskId: task._id, message: newComment });
      setComments((prev) => [...prev, data]);
      setNewComment('');
      addToast('Comment added', 'success');
    } catch (error) {
      console.error('Error adding comment:', error);
      addToast('Failed to add comment', 'error');
    }
  };

  const handleStartEditComment = (comment) => {
    setEditingCommentId(comment._id);
    setEditingCommentText(comment.message);
  };

  const handleUpdateComment = async (commentId) => {
    if (!editingCommentText.trim()) return;

    try {
      const { data } = await API.put(`/comments/${commentId}`, { message: editingCommentText });
      setComments((prev) =>
        prev.map((c) => (c._id === commentId ? { ...c, message: data.message } : c))
      );
      setEditingCommentId(null);
      setEditingCommentText('');
      addToast('Comment updated', 'success');
    } catch (error) {
      console.error('Error editing comment:', error);
      addToast('Failed to update comment', 'error');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;

    try {
      await API.delete(`/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
      addToast('Comment deleted', 'success');
    } catch (error) {
      console.error('Error deleting comment:', error);
      addToast('Failed to delete comment', 'error');
    }
  };

  const getInitials = (n) => {
    if (!n) return 'U';
    return n.split(' ').map((i) => i[0]).join('').substring(0, 2);
  };

  if (!task) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Task Details' : task.title}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px', marginTop: '10px' }}>
        {/* Left Side: Description / Edit Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isEditing ? (
            <form onSubmit={handleSaveAll} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Task Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '120px', resize: 'vertical' }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tags (Comma separated)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="marketing, ui, bug"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <span className="spinner spinner-sm"></span> : 'Save Changes'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)} disabled={loading}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
                {canManage && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setIsEditing(true)}>
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>
                    <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleDeleteTask}>
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>

              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Description</h4>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--card-border)' }}>
                {task.description || 'No description provided.'}
              </p>

              {task.tags && task.tags.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Tags</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {task.tags.map((t) => (
                      <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
                        <Tag size={10} />
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nested Comments Section */}
          <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '20px', marginTop: '10px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} />
              <span>Comments ({comments.length})</span>
            </h3>

            {/* Comment Form */}
            <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 14px' }}>
                <Send size={16} />
              </button>
            </form>

            {/* Comments List */}
            {commentsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
                <div className="spinner spinner-sm"></div>
              </div>
            ) : comments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                {comments.map((comment) => {
                  const isAuthor = comment.author?._id === user?._id;
                  const isCommentEditing = editingCommentId === comment._id;

                  return (
                    <div key={comment._id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '0.75rem', flexShrink: 0 }}>
                        {getInitials(comment.author?.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{comment.author?.name}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={10} />
                            {new Date(comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {isCommentEditing ? (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                            <input
                              type="text"
                              className="form-input"
                              style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                            />
                            <button className="btn btn-primary" style={{ padding: '6px' }} onClick={() => handleUpdateComment(comment._id)}>
                              <Check size={14} />
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setEditingCommentId(null)}>
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--card-border)', whiteSpace: 'pre-wrap' }}>
                            {comment.message}
                          </p>
                        )}

                        {isAuthor && !isCommentEditing && (
                          <div style={{ display: 'flex', gap: '10px', marginTop: '4px', fontSize: '0.75rem' }}>
                            <button
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                              onClick={() => handleStartEditComment(comment)}
                            >
                              Edit
                            </button>
                            <button
                              style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                              onClick={() => handleDeleteComment(comment._id)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No comments yet. Start the conversation!
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Quick Field Editors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--bg-primary)', padding: '20px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--card-border)', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', marginBottom: '4px' }}>Properties</h3>

          {/* Assignee */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
              <User size={14} />
              <span>Assignee</span>
            </label>

            {canManage ? (
              /* PM dropdown — uses assignableMembers (excludes self) */
              <select
                className="filter-select"
                style={{ width: '100%', padding: '10px' }}
                value={assignedTo}
                onChange={(e) => {
                  setAssignedTo(e.target.value);
                  handleFieldChange('assignedTo', e.target.value);
                }}
                disabled={isEditing}
              >
                <option value="unassigned">Unassigned</option>
                {(assignableMembers || projectMembers || []).map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} — {m.role}
                  </option>
                ))}
              </select>
            ) : (
              /* Member / read-only — rich display card */
              (() => {
                // Find the assigned member from the full projectMembers list
                const assignedMember = (projectMembers || []).find(
                  (m) => m._id === assignedTo
                );
                if (!assignedMember) {
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: 'var(--border-radius-sm)',
                      background: 'var(--bg-tertiary)', border: '1px solid var(--card-border)',
                    }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: 'var(--card-border)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <User size={14} color="var(--text-muted)" />
                      </div>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Unassigned</span>
                    </div>
                  );
                }
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: 'var(--border-radius-sm)',
                    background: 'var(--bg-tertiary)', border: '1px solid var(--card-border)',
                  }}>
                    <div className="avatar" style={{ width: '36px', height: '36px', fontSize: '0.85rem', flexShrink: 0 }}>
                      {getInitials(assignedMember.name)}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {assignedMember.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {assignedMember.role}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>

          {/* Status */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
              <AlertCircle size={14} />
              <span>Status</span>
            </label>
            <select
              className="filter-select"
              style={{ width: '100%', padding: '10px' }}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                const isAssignee = task?.assignedTo?._id === user?._id || task?.assignedTo === user?._id;
                if (canManage || isAssignee) handleFieldChange('status', e.target.value);
              }}
              disabled={isEditing || (!canManage && !(task?.assignedTo?._id === user?._id || task?.assignedTo === user?._id))}
            >
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
              <AlertCircle size={14} />
              <span>Priority</span>
            </label>
            <select
              className="filter-select"
              style={{ width: '100%', padding: '10px' }}
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                if (canManage) handleFieldChange('priority', e.target.value);
              }}
              disabled={isEditing || !canManage}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
              <Calendar size={14} />
              <span>Due Date</span>
            </label>
            <input
              type="date" 
              className="form-input"
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                if (canManage) handleFieldChange('dueDate', e.target.value || null);
              }}
              disabled={isEditing || !canManage}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default TaskDetailsModal;
