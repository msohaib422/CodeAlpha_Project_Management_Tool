import React, { useState, useEffect, useContext } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import Modal from '../components/Modal';
import { Plus, Archive, Trash2, Users, Folder, ChevronRight, Check } from 'lucide-react';

const Projects = () => {
  const { user } = useContext(AuthContext);
  const { addToast } = useContext(NotificationContext);
  const [searchParams] = useSearchParams();
  const searchVal = searchParams.get('search') || '';

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New Project Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter
  const [showArchived, setShowArchived] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/projects?search=${encodeURIComponent(searchVal)}&archived=${showArchived}`);
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
      addToast('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [searchVal, showArchived]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) {
      setFormError('Project name is required');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await API.post('/projects', { name, description });
      setProjects((prev) => [data, ...prev]);
      setIsModalOpen(false);
      setName('');
      setDescription('');
      addToast('Project created successfully!', 'success');
      fetchProjects(); // reload to get initialized stats
    } catch (error) {
      console.error('Error creating project:', error);
      setFormError(error.response?.data?.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleArchive = async (projectId, currentStatus) => {
    try {
      const { data } = await API.put(`/projects/${projectId}`, { archived: !currentStatus });
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
      addToast(
        `Project ${!currentStatus ? 'archived' : 'restored'} successfully!`,
        'success'
      );
    } catch (error) {
      console.error('Error toggling archive:', error);
      addToast('Failed to change project archive state', 'error');
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project? This action is permanent.')) {
      return;
    }

    try {
      await API.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
      addToast('Project deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting project:', error);
      addToast(error.response?.data?.message || 'Failed to delete project', 'error');
    }
  };

  const getInitials = (n) => {
    if (!n) return 'U';
    return n.split(' ').map((i) => i[0]).join('').substring(0, 2);
  };

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            {searchVal ? `Search results for "${searchVal}"` : 'Manage and collaborate on your workspaces'}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className={`btn ${!showArchived ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowArchived(false)}
          >
            Active
          </button>
          <button
            className={`btn ${showArchived ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowArchived(true)}
          >
            Archived
          </button>
          {/* Only Root Admin can create projects */}
          {user?.role === 'Admin' && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} />
              <span>New Project</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', height: '40vh', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner"></div>
        </div>
      ) : projects.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px',
          }}
        >
          {projects.map((project) => {
            const isOwner = project.owner?._id === user?._id;
            const progress = project.totalTasks > 0
              ? Math.round((project.completedTasks / project.totalTasks) * 100)
              : 0;

            return (
              <div key={project._id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '220px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: isOwner ? 'rgba(99, 102, 241, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                        color: isOwner ? 'var(--primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {isOwner ? 'Owner' : 'Member'}
                    </span>
                    
                    {isOwner && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="nav-icon-btn"
                          style={{ padding: '6px' }}
                          title={project.archived ? 'Restore Project' : 'Archive Project'}
                          onClick={() => handleToggleArchive(project._id, project.archived)}
                        >
                          <Archive size={14} />
                        </button>
                        <button
                          className="nav-icon-btn"
                          style={{ padding: '6px', color: 'var(--error)' }}
                          title="Delete Project"
                          onClick={() => handleDeleteProject(project._id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <Link to={`/projects/${project._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Folder size={18} color="var(--primary)" />
                      <span>{project.name}</span>
                    </h2>
                  </Link>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '40px' }}>
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                <div>
                  {/* Progress Bar */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <span>Progress</span>
                      <span>{progress}% ({project.completedTasks}/{project.totalTasks} tasks)</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', borderRadius: '3px' }}></div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--card-border)', paddingTop: '12px' }}>
                    <div className="avatar-stack">
                      {project.members?.slice(0, 4).map((member) => {
                        const mUser = member.user || member;
                        return (
                          <div
                            key={mUser._id}
                            className="avatar"
                            style={{ width: '28px', height: '28px', fontSize: '0.75rem' }}
                            title={mUser.name}
                          >
                            {getInitials(mUser.name)}
                          </div>
                        );
                      })}
                      {project.members?.length > 4 && (
                        <div
                          className="avatar"
                          style={{ width: '28px', height: '28px', fontSize: '0.75rem', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                        >
                          +{project.members.length - 4}
                        </div>
                      )}
                    </div>

                    <Link
                      to={`/projects/${project._id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '0.85rem',
                        color: 'var(--primary)',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      <span>Open Board</span>
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Folder size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '8px' }}>No Projects Found</h3>
          <p style={{ fontSize: '0.9rem', marginBottom: '20px' }}>
            {searchVal ? 'Try adjusting your search terms.' : 'Create a project to start collaborating.'}
          </p>
          {!searchVal && user?.role === 'Admin' && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} />
              <span>Create Project</span>
            </button>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Project">
        <form onSubmit={handleCreateProject}>
          {formError && (
            <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '10px', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '16px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {formError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Project Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Website Redesign"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Description (Optional)</label>
            <textarea
              className="form-input"
              style={{ minHeight: '100px', resize: 'vertical' }}
              placeholder="Explain the goals of this project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner spinner-sm"></span> : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Projects;
