import React from 'react';
import { useNotifications } from '../context/NotificationContext';
import { UserPlus, ClipboardPlus, CirclePlus, RefreshCw, MessageCircle, CircleCheck, RotateCcw, Sparkles, Calendar, Check, Trash2, Clock, Sun, Moon } from 'lucide-react';

export default function NotificationsView({ onEditIssue, theme, toggleTheme }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  const getIconForType = (type) => {
    switch (type) {
      case 'ISSUE_ASSIGNED':
        return <UserPlus className="w-5 h-5 text-blue-500" />;
      case 'ISSUE_CREATED':
        return <CirclePlus className="w-5 h-5 text-blue-400" />;
      case 'STATUS_CHANGED':
      case 'PRIORITY_CHANGED':
      case 'SEVERITY_CHANGED':
        return <RefreshCw className="w-5 h-5 text-yellow-500" />;
      case 'COMMENT_ADDED':
      case 'ISSUE_MENTION':
        return <MessageCircle className="w-5 h-5 text-purple-400" />;
      case 'ISSUE_RESOLVED':
        return <CircleCheck className="w-5 h-5 text-green-500" />;
      case 'ISSUE_REOPENED':
        return <RotateCcw className="w-5 h-5 text-orange-500" />;
      case 'AI_RESOLUTION':
        return <Sparkles className="w-5 h-5 text-purple-500" />;
      case 'SPRINT_EVENT':
        return <Calendar className="w-5 h-5 text-indigo-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }
    
    // If the notification has an issue_id, we can open that issue
    if (notif.issue_id && onEditIssue) {
      // Create a partial issue object to trigger the edit modal 
      // The modal will then fetch full issue details if needed
      onEditIssue({ id: notif.issue_id });
    }
    // Alternatively, if it has a project_id, handle project navigation if needed
    // But currently we don't have a direct "onEditProject" handler.
  };

  return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            Notifications
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            All your recent system activity and updates
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={toggleTheme} className="btn-secondary" title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"} style={{ padding: '10px' }}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <Check size={16} /> Mark all as read
            </button>
          )}
        </div>
      </div>

      <div style={{
        height: '1px',
        background: 'var(--border-color)',
        marginBottom: '24px'
      }}></div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {notifications.length === 0 ? (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            color: 'var(--text-secondary)'
          }}>
            You have no notifications at the moment.
          </div>
        ) : (
          notifications.map((notif) => (
            <div 
              key={notif.id} 
              onClick={() => handleNotificationClick(notif)}
              style={{
                position: 'relative',
                display: 'flex',
                gap: '16px',
                padding: '16px',
                borderRadius: '12px',
                background: notif.is_read ? 'var(--bg-card)' : 'rgba(124, 58, 237, 0.1)',
                border: notif.is_read ? '1px solid var(--border-color)' : '1px solid rgba(168, 85, 247, 0.4)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ marginTop: '4px' }}>
                {getIconForType(notif.type)}
              </div>
              
              <div style={{ flex: 1, paddingRight: '24px' }}>
                <div style={{
                  fontSize: '0.95rem',
                  fontWeight: notif.is_read ? 600 : 700,
                  color: notif.is_read ? 'var(--text-primary)' : 'var(--text-main)',
                  marginBottom: '4px'
                }}>
                  {notif.title}
                </div>
                
                <div style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  marginBottom: '8px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {notif.message}
                </div>
                
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  opacity: 0.8
                }}>
                  {new Date(notif.created_at).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>
              
              {/* Unread indicator */}
              {!notif.is_read && (
                <div style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  width: '8px',
                  height: '8px',
                  background: 'var(--primary-light)',
                  borderRadius: '50%',
                  boxShadow: '0 0 8px rgba(168, 85, 247, 0.8)'
                }}></div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
