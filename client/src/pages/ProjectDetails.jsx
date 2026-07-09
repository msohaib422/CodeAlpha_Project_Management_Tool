import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import TaskDetailsModal from '../components/TaskDetailsModal';
import Modal from '../components/Modal';
import { Plus, Calendar, Trash2, ArrowLeft, Search, Filter, X, UserPlus as UserPlusIcon } from 'lucide-react';
import './board.css';

const ProjectDetails = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const { addToast } = useContext(NotificationContext);

  // States
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activeTab, setActiveTab] = useState('board');
  const [loading, setLoading] = useState(true);

  // Pagination for Activities
  const [activityPage, setActivityPage] = useState(1);
  const [activityPages, setActivityPages] = useState(1);
  const [loadingMoreActivities, setLoadingMoreActivities] = useState(false);

  // Modal States
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState('todo');

  // Filter States
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterDueDate, setFilterDueDate] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('unassigned');
  const [submittingTask, setSubmittingTask] = useState(false);

  // Invitation State
  const [inviteEmail, setInviteEmail] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedInvitee, setSelectedInvitee] = useState(null);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [projectInvitations, setProjectInvitations] = useState([]);
  const [sendingInvite, setSendingInvite] = useState(false);

  // ─── Permission Helpers ────────────────────────────────────────────────────
  // isAdmin: system-wide root admin
  const isAdmin = user?.role === 'Admin';
  // isProjectOwner: user is the project's owner field (typically the Admin who created it)
  const isProjectOwner = project ? String(project.owner?._id || project.owner) === String(user?._id) : false;
  // isProjectPM: user holds projectRole === 'Project Manager' in the members array
  const isProjectPM = project
    ? project.members?.some((m) => {
        const mid = String(m.user?._id || m.user);
        return mid === String(user?._id) && m.projectRole === 'Project Manager';
      })
    : false;
  // canManage: create/edit/delete tasks — Admin, Project Owner, or Project Manager
  const canManage = isAdmin || isProjectOwner || isProjectPM;
  // canInvite: invite/remove members — Admin, Project Owner, or Project Manager
  const canInvite = isAdmin || isProjectOwner || isProjectPM;
  // ──────────────────────────────────────────────────────────────────────────

  const fetchProjectInvitations = async () => {
    try {
      const { data } = await API.get(`/invitations/project/${id}`);
      setProjectInvitations(data);
    } catch (err) {
      // Non-managers will get 403 — silently ignore
    }
  };

  const fetchProjectDetails = async () => {
    try {
      const { data } = await API.get(`/projects/${id}`);
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
      addToast('Failed to load project details', 'error');
    }
  };

  const fetchTasks = async () => {
    try {
      let queryStr = `/tasks?projectId=${id}&limit=100`;
      if (filterPriority) queryStr += `&priority=${filterPriority}`;
      if (filterAssignee) queryStr += `&assignedTo=${filterAssignee}`;
      if (filterDueDate) queryStr += `&dueDate=${filterDueDate}`;
      if (filterSearch) queryStr += `&search=${encodeURIComponent(filterSearch)}`;
      const { data } = await API.get(queryStr);
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
      addToast('Failed to load tasks', 'error');
    }
  };

  const fetchActivities = async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoadingMoreActivities(true);
    try {
      const { data } = await API.get(`/projects/${id}/activity?page=${pageNum}&limit=8`);
      if (append) {
        setActivities((prev) => [...prev, ...data.activities]);
      } else {
        setActivities(data.activities || []);
      }
      setActivityPage(data.page);
      setActivityPages(data.pages);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoadingMoreActivities(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchProjectDetails();
      await fetchTasks();
      await fetchActivities(1, false);
      setLoading(false);
    };
    init();
  }, [id]);

  // Fetch invitations once project is loaded and user can invite
  useEffect(() => {
    if (project && canInvite) {
      fetchProjectInvitations();
    }
  }, [project, canInvite]);

  useEffect(() => {
    if (project) fetchTasks();
  }, [filterPriority, filterAssignee, filterDueDate, filterSearch]);

  const handleLoadMoreActivities = () => {
    if (activityPage < activityPages) {
      fetchActivities(activityPage + 1, true);
    }
  };

  // Search users for invite (exclude existing members + admin accounts)
  useEffect(() => {
    const search = async () => {
      if (inviteEmail.trim().length < 2) { setSearchResults([]); return; }
      setSearchingUsers(true);
      try {
        const { data } = await API.get(`/users/search?query=${encodeURIComponent(inviteEmail)}`);
        const memberIds = project?.members?.map((m) => m.user?._id || m.user) || [];
        // Exclude already members and Admin accounts
        const filtered = data.filter((u) => !memberIds.includes(u._id) && u.role !== 'Admin');
        setSearchResults(filtered);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setSearchingUsers(false);
      }
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [inviteEmail, project]);

  // Send invitation — no role selection, backend auto-uses org role
  const handleSendInvitation = async (e) => {
    e.preventDefault();
    if (!selectedInvitee) { addToast('Please select a user to invite', 'error'); return; }
    setSendingInvite(true);
    try {
      await API.post('/invitations', { projectId: id, inviteeEmail: selectedInvitee.email });
      addToast(`Invitation sent to ${selectedInvitee.name}`, 'success');
      setSelectedInvitee(null);
      setInviteEmail('');
      setSearchResults([]);
      fetchProjectInvitations();
    } catch (error) {
      addToast(error.response?.data?.message || 'Failed to send invitation', 'error');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCancelInvitation = async (invId) => {
    try {
      await API.delete(`/invitations/${invId}`);
      addToast('Invitation cancelled', 'success');
      fetchProjectInvitations();
    } catch (err) {
      addToast('Failed to cancel invitation', 'error');
    }
  };

  const handleRemoveMember = async (memberId) => {
    const ownerId = project.owner?._id || project.owner;
    if (memberId === ownerId) return;
    if (!window.confirm('Are you sure you want to remove this member from the project?')) return;
    try {
      const { data } = await API.delete(`/projects/${id}/members/${memberId}`);
      setProject(data);
      addToast('Member removed from project', 'success');
      fetchActivities(1, false);
    } catch (error) {
      addToast(error.response?.data?.message || 'Failed to remove member', 'error');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) { addToast('Task title is required', 'error'); return; }
    setSubmittingTask(true);
    try {
      const payload = {
        title: newTaskTitle,
        description: newTaskDesc,
        priority: newTaskPriority,
        status: newTaskColumn,
        dueDate: newTaskDueDate || null,
        projectId: id,
        assignedTo: newTaskAssignee === 'unassigned' ? null : newTaskAssignee,
      };
      const { data } = await API.post('/tasks', payload);
      setTasks((prev) => [...prev, data]);
      setIsNewTaskOpen(false);
      setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskPriority('medium');
      setNewTaskDueDate(''); setNewTaskAssignee('unassigned');
      addToast('Task created successfully', 'success');
      fetchActivities(1, false);
    } catch (error) {
      addToast(error.response?.data?.message || 'Failed to create task', 'error');
    } finally {
      setSubmittingTask(false);
    }
  };

  // Drag and Drop
  const handleDragStart = (e, taskId) => {
    const task = tasks.find((t) => t._id === taskId);
    const isAssignee = task && (task.assignedTo?._id === user?._id || task.assignedTo === user?._id);
    if (!canManage && !isAssignee) { e.preventDefault(); return; }
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, columnStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const targetTask = tasks.find((t) => t._id === taskId);
    if (!targetTask || targetTask.status === columnStatus) return;

    const isAssignee = targetTask.assignedTo?._id === user?._id || targetTask.assignedTo === user?._id;
    if (!canManage && !isAssignee) {
      addToast('You can only move tasks assigned to you', 'error');
      return;
    }

    const oldStatus = targetTask.status;
    setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status: columnStatus } : t)));

    try {
      const { data } = await API.put(`/tasks/${taskId}`, { status: columnStatus });
      setTasks((prev) => prev.map((t) => (t._id === taskId ? data : t)));
      fetchActivities(1, false);
    } catch (error) {
      setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status: oldStatus } : t)));
      addToast('Failed to move task', 'error');
    }
  };

  const handleTaskClick = (task) => { setSelectedTask(task); setIsTaskModalOpen(true); };
  const handleTaskUpdated = (updated) => {
    setTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    setSelectedTask(updated);
  };
  const handleTaskDeleted = (deletedId) => {
    setTasks((prev) => prev.filter((t) => t._id !== deletedId));
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  const getInitials = (n) => {
    if (!n) return 'U';
    return n.split(' ').map((i) => i[0]).join('').substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px 0' }}>
        <h2>Project not found or access denied.</h2>
        <Link to="/projects" className="btn btn-primary" style={{ marginTop: '20px' }}>
          <ArrowLeft size={16} />
          <span>Back to Projects</span>
        </Link>
      </div>
    );
  }

  const columns = {
    todo: tasks.filter((t) => t.status === 'todo'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    review: tasks.filter((t) => t.status === 'review'),
    completed: tasks.filter((t) => t.status === 'completed'),
  };

  // Flatten project members for dropdowns — correctly map {user, projectRole} objects
  // Excludes Admin (unless they are the PM/owner) and keeps only actual project members
  const projectMembersList = project.members
    ?.map((m) => m.user || m)
    .filter(Boolean)
    .filter((u) => u.role !== 'Admin' || project?.owner?._id === u._id) || [];

  // For the "Assign To" dropdown: exclude the current logged-in user (PM)
  // PMs assign tasks TO team members, not to themselves
  const assignableMembersList = projectMembersList.filter(
    (m) => String(m._id) !== String(user?._id)
  );

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '1px solid var(--card-border)', paddingBottom: '20px' }}>
        <Link to="/projects" className="nav-icon-btn" style={{ marginTop: '4px' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className="page-title">{project.name}</h1>
            {isProjectPM && (
              <span style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', padding: '3px 10px', borderRadius: '12px', fontWeight: 700, border: '1px solid rgba(99,102,241,0.3)' }}>
                Project Manager
              </span>
            )}
            {isAdmin && !isProjectPM && (
              <span style={{ fontSize: '0.72rem', background: 'rgba(16,185,129,0.12)', color: 'var(--success)', padding: '3px 10px', borderRadius: '12px', fontWeight: 700, border: '1px solid rgba(16,185,129,0.3)' }}>
                Admin
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px', maxWidth: '800px' }}>
            {project.description || 'No description provided.'}
          </p>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', display: 'block' }}>
            Managed by <strong>{project.owner?.name}</strong> · Created {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-header">
        <button className={`tab-btn ${activeTab === 'board' ? 'active' : ''}`} onClick={() => setActiveTab('board')}>
          Kanban Board
        </button>
        <button className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>
          Members ({project.members?.filter(m => (m.user?.role || m.role) !== 'Admin').length || 0})
        </button>
        <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
          Activity Log
        </button>
      </div>

      {/* BOARD TAB */}
      {activeTab === 'board' && (
        <div>
          {/* Filters Row */}
          <div className="glass-panel filter-bar">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Filter size={14} />
              <span>Filters:</span>
            </span>

            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search tasks..."
                className="filter-select"
                style={{ width: '100%', paddingLeft: '32px' }}
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
            </div>

            <select className="filter-select" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            {/* Assignee filter uses real project members */}
            <select className="filter-select" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
              <option value="">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {projectMembersList.map((m) => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>

            <select className="filter-select" value={filterDueDate} onChange={(e) => setFilterDueDate(e.target.value)}>
              <option value="">Any Due Date</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="this_week">Due This Week</option>
            </select>
          </div>

          {/* Kanban Lanes */}
          <div className="board-container">
            {Object.keys(columns).map((statusKey) => {
              const statusName = statusKey.replace('_', ' ');
              const list = columns[statusKey];

              return (
                <div
                  key={statusKey}
                  className="board-column"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, statusKey)}
                >
                  <div className="column-header">
                    <div className="column-title">
                      <span className={`badge badge-${statusKey}`} style={{ display: 'inline-block', width: '8px', height: '8px', padding: 0, marginRight: '4px' }}></span>
                      <span style={{ textTransform: 'capitalize' }}>{statusName}</span>
                      <span className="column-count">{list.length}</span>
                    </div>
                    {/* + button only visible to PM/Admin */}
                    {canManage && (
                      <button
                        className="nav-icon-btn"
                        style={{ padding: '4px' }}
                        title="Add task in lane"
                        onClick={() => { setNewTaskColumn(statusKey); setIsNewTaskOpen(true); }}
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>

                  <div className="column-cards-container">
                    {list.length > 0 ? (
                      list.map((task) => {
                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
                        return (
                          <div
                            key={task._id}
                            className="task-card glass-panel"
                            draggable={canManage || task.assignedTo?._id === user?._id || task.assignedTo === user?._id}
                            onDragStart={(e) => handleDragStart(e, task._id)}
                            onClick={() => handleTaskClick(task)}
                            style={{ cursor: 'pointer', opacity: 1 }}
                          >
                            <div className="task-card-header">
                              <span className={`badge badge-${task.priority}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>{task.priority}</span>
                              {(canManage || task.assignedTo?._id === user?._id || task.assignedTo === user?._id) && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>⠿ drag</span>
                              )}
                            </div>
                            <h3 className="task-card-title">{task.title}</h3>
                            {task.description && <p className="task-card-desc">{task.description}</p>}

                            {task.tags && task.tags.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                                {task.tags.map((t) => (
                                  <span key={t} style={{ fontSize: '0.65rem', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '3px', border: '1px solid var(--card-border)' }}>
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="task-card-footer">
                              <div className={`task-card-date ${isOverdue ? 'overdue' : ''}`}>
                                <Calendar size={12} />
                                <span>
                                  {task.dueDate
                                    ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                    : 'No date'}
                                </span>
                              </div>
                              {task.assignedTo && (
                                <div
                                  className="avatar"
                                  style={{ width: '24px', height: '24px', fontSize: '0.7rem' }}
                                  title={`Assigned to ${task.assignedTo.name}`}
                                >
                                  {getInitials(task.assignedTo.name)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {canManage ? 'Click + to add a task here.' : 'No tasks in this column.'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MEMBERS TAB */}
      {activeTab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* Invite Box — Admin or PM */}
          {canInvite && (
            <div className="glass-panel" style={{ padding: '24px', maxWidth: '560px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '18px' }}>Invite Team Member</h2>

              {!selectedInvitee ? (
                <div>
                  <div className="form-group" style={{ position: 'relative', marginBottom: searchResults.length > 0 ? '8px' : '0' }}>
                    <label className="form-label">Search by name or email</label>
                    <Search size={16} style={{ position: 'absolute', left: '12px', bottom: '13px', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="e.g. john@company.com"
                      className="form-input"
                      style={{ paddingLeft: '38px' }}
                      value={inviteEmail}
                      onChange={(e) => { setInviteEmail(e.target.value); setSelectedInvitee(null); }}
                    />
                  </div>

                  {searchResults.length > 0 && (
                    <div style={{ border: '1px solid var(--card-border)', background: 'var(--bg-primary)', borderRadius: '8px', overflow: 'hidden' }}>
                      {searchResults.map((u) => (
                        <div
                          key={u._id}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--card-border)', transition: 'background 0.15s' }}
                          onClick={() => { setSelectedInvitee(u); setInviteEmail(u.email); setSearchResults([]); }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div className="avatar" style={{ width: '36px', height: '36px', fontSize: '0.85rem', flexShrink: 0 }}>
                            {getInitials(u.name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.name}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {u.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {inviteEmail.trim().length >= 2 && searchResults.length === 0 && !searchingUsers && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>No users found matching "{inviteEmail}"</p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSendInvitation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Selected user card — show their org role which will be auto-used */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px' }}>
                    <div className="avatar" style={{ width: '40px', height: '40px', fontSize: '0.9rem', flexShrink: 0 }}>
                      {getInitials(selectedInvitee.name)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{selectedInvitee.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedInvitee.email}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginTop: '2px' }}>
                        Will join as: <strong>{selectedInvitee.role}</strong>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setSelectedInvitee(null); setInviteEmail(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                      <X size={16} />
                    </button>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--card-border)', margin: 0 }}>
                    ℹ️ Their organization role <strong>{selectedInvitee.role}</strong> will automatically be used as their project role.
                  </p>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="btn" style={{ flex: 1 }} onClick={() => { setSelectedInvitee(null); setInviteEmail(''); }}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={sendingInvite}>
                      {sendingInvite ? <span className="spinner spinner-sm" /> : <><UserPlusIcon size={16} /> Send Invitation</>}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Pending Invitations — Admin or PM */}
          {canInvite && projectInvitations.filter((i) => i.status === 'Pending').length > 0 && (
            <div style={{ maxWidth: '560px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
                Pending Invitations ({projectInvitations.filter((i) => i.status === 'Pending').length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {projectInvitations.filter((i) => i.status === 'Pending').map((inv) => (
                  <div key={inv._id} className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '3px solid #f59e0b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem', background: '#f59e0b', flexShrink: 0 }}>
                        {getInitials(inv.invitee?.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{inv.invitee?.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {inv.invitee?.email} · <span style={{ color: 'var(--primary)' }}>{inv.invitee?.role}</span>
                        </div>
                      </div>
                    </div>
                    <button className="btn" style={{ padding: '5px 10px', fontSize: '0.75rem', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.25)' }} onClick={() => handleCancelInvitation(inv._id)}>
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members list — visible to all project members */}
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>
              Project Team ({project.members?.filter(m => (m.user?.role || m.role) !== 'Admin').length || 0})
            </h2>
            <div className="members-list">
              {project.members?.filter((member, index, self) => {
                 const memberUser = member.user || member;
                 if (!memberUser || !memberUser._id) return false;
                 // Prevent duplicates: only keep the first occurrence of each user ID
                 const uid = String(memberUser._id);
                 if (self.findIndex(m => String(m.user?._id || m.user) === uid) !== index) return false;
                 // Hide Root Admin entries from the visible list
                 return memberUser.role !== 'Admin';
              }).map((member) => {
                const memberUser  = member.user || member;
                // Is THIS member card the project owner?
                const isMemberTheOwner = String(memberUser._id) === String(project.owner?._id || project.owner);
                // Is THIS member card the logged-in user?
                const isMemberSelf     = String(memberUser._id) === String(user?._id);
                // Does THIS member card represent a PM?
                const isMemberPM = member.projectRole === 'Project Manager' || isMemberTheOwner;

                return (
                  <div key={memberUser._id} className="glass-panel member-card">
                    <div className="member-card-info">
                      <div className="avatar">{getInitials(memberUser.name)}</div>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block' }}>{memberUser.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, display: 'block' }}>
                          {member.projectRole || memberUser.role}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isMemberPM && (
                        <span style={{ fontSize: '0.7rem', background: 'var(--primary-glow)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          PM
                        </span>
                      )}
                      {/* Show remove button: only if the viewer has canInvite permission,
                          the member is NOT themselves, and the member is NOT a PM (unless viewer is Root Admin) */}
                      {canInvite && !isMemberSelf && !isMemberTheOwner && (isAdmin || !isMemberPM) && (
                        <button
                          className="btn"
                          style={{ padding: '4px 8px', color: 'var(--error)', border: 'none', background: 'none' }}
                          onClick={() => handleRemoveMember(memberUser._id)}
                          title="Remove Member"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVITY LOGS TAB */}
      {activeTab === 'logs' && (
        <div style={{ maxWidth: '650px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '20px' }}>Project Activities</h2>
          {activities.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="timeline">
                {activities.map((act) => (
                  <div key={act._id} className="timeline-item">
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{act.details || act.action}</p>
                      <span className="timeline-time">
                        by {act.user?.name || 'Unknown User'} &bull; {new Date(act.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {activityPage < activityPages && (
                <button
                  className="btn btn-secondary"
                  style={{ alignSelf: 'center', marginTop: '10px' }}
                  onClick={handleLoadMoreActivities}
                  disabled={loadingMoreActivities}
                >
                  {loadingMoreActivities ? 'Loading...' : 'Load More Activities'}
                </button>
              )}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No activities logged yet.
            </div>
          )}
        </div>
      )}

      {/* Create Task Modal — only accessible to PM/Admin */}
      {canManage && (
        <Modal isOpen={isNewTaskOpen} onClose={() => setIsNewTaskOpen(false)} title={`Create Task in ${newTaskColumn.replace('_', ' ')}`}>
          <form onSubmit={handleCreateTask}>
            <div className="form-group">
              <label className="form-label">Task Title</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Design Login Modal"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                disabled={submittingTask}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <textarea
                className="form-input"
                style={{ minHeight: '80px', resize: 'vertical' }}
                placeholder="Write task details here..."
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                disabled={submittingTask}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="filter-select" style={{ width: '100%', padding: '10px' }} value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)} disabled={submittingTask}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="form-group">
  <label className="form-label">Assign To</label>

  <select
    className="filter-select"
    style={{ width: "100%", padding: "10px" }}
    value={newTaskAssignee}
    onChange={(e) => setNewTaskAssignee(e.target.value)}
    disabled={submittingTask}
  >
    <option value="unassigned">Unassigned</option>

    {assignableMembersList
      .filter((m) => m.role !== "Admin")
      .map((m) => (
        <option key={m._id} value={m._id}>
          {m.name} — {m.role}
        </option>
      ))}
  </select>
</div>
            </div>

            <div className="form-group" style={{ marginBottom: '28px' }}>
              <label className="form-label">Due Date (Optional)</label>
              <input
                type="date"
                className="form-input"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                disabled={submittingTask}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsNewTaskOpen(false)} disabled={submittingTask}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submittingTask}>
                {submittingTask ? <span className="spinner spinner-sm"></span> : 'Create Task'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Task Details Modal */}
      <TaskDetailsModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        task={selectedTask}
        projectMembers={projectMembersList}
        assignableMembers={assignableMembersList}
        canManage={canManage}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />
    </div>
  );
};

export default ProjectDetails;
