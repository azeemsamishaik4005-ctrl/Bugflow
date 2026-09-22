import React from 'react';
import { LayoutDashboard, AlertCircle, FolderKanban, LogOut, Sparkles, UserCheck, Bell, Sun, Moon, BarChart3 } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export default function Sidebar({ activeTab, setActiveTab, user, onLogout, onRequestReportIssue, theme, toggleTheme }) {
  const { unreadCount } = useNotifications();
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'issues', label: 'Issues', icon: AlertCircle },
    { id: 'sprints', label: 'Sprints', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];


  return (
    <aside style={{
      width: '260px',
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '24px 16px',
      minHeight: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 100
    }}>
      {/* Brand Header */}
      <div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '0 8px 24px 8px',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            padding: '0'
          }}>
            <img 
              src="/logo-transparent.png" 
              alt="DefectX Logo" 
              style={{
                width: '100px',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
                marginBottom: '10px'
              }}
            />
            <h1 style={{ 
              fontSize: '1.4rem', 
              fontWeight: '700', 
              color: 'var(--text-main)', 
              margin: '0 0 6px 0', 
              textAlign: 'center',
              letterSpacing: '-0.5px'
            }}>
              DefectX
            </h1>
            <p style={{ 
              fontSize: '11px', 
              color: 'var(--text-muted)', 
              textAlign: 'center', 
              margin: '0', 
              lineHeight: '1.4',
              padding: '0 4px'
            }}>
              Intelligent Software<br />Defect Tracking System<br />with Resolution Assistant
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onRequestReportIssue}
          className="btn-primary"
          style={{
            width: '100%',
            justifyContent: 'center',
            marginBottom: '24px',
            padding: '12px 16px'
          }}
        >
          <Sparkles size={18} />
          Report Issue
        </button>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: isActive ? 'var(--primary-glow)' : 'transparent',
                  color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                  borderLeft: isActive ? '3px solid var(--primary-violet)' : '3px solid transparent',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icon size={19} color={isActive ? 'var(--primary-violet)' : 'var(--text-muted)'} />
                  {item.label}
                </div>
                {item.id === 'notifications' && unreadCount > 0 && (
                  <div style={{
                    background: '#EF4444',
                    color: 'var(--text-main)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '10px',
                    minWidth: '20px',
                    textAlign: 'center'
                  }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Section */}
      <div>
        {/* User Footer */}
        <div style={{
          paddingTop: '20px',
          borderTop: '1px solid var(--border-color)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card)',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'var(--primary-glow)',
                border: '1px solid var(--primary-violet)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <UserCheck size={18} color="var(--primary-violet)" />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name || 'User'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email || ''}
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Logout"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#F87171'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
