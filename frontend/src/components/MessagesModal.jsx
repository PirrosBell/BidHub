import React, { useEffect, useRef, useState } from 'react';
import '../styles/NotificationPopup.css';
import useApi from '../utils/UseApi';

const MessagesDropdown = ({ isOpen, onClose, conversations, isLoading, error, onSelect, anchorRef }) => {
  if (!isOpen) return null;
  const panelRef = useRef(null);
  const [removedIds, setRemovedIds] = useState(new Set());
  const [deleteEndpoint, setDeleteEndpoint] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // conversation pending deletion
  // useApi hook for deletion (manual trigger)
  const { data: deleteData, error: deleteError, isLoading: deleteLoading, refetch: runDelete } = useApi(deleteEndpoint, 'DELETE', null, false);

  useEffect(() => {
    const handler = (e) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(e.target)) return;
      if (anchorRef?.current && anchorRef.current.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('focusin', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('focusin', handler);
    };
  }, [onClose, anchorRef]);

  // When deleteEndpoint changes (after user confirms), perform the delete
  useEffect(() => {
    const doDelete = async () => {
      if (!deleteEndpoint || !deletingId) return;
      try {
        await runDelete();
        if (!deleteError) {
          setRemovedIds(prev => new Set([...prev, deletingId]));
        } else {
          alert('Failed to delete: ' + deleteError);
        }
      } finally {
        setDeleteEndpoint(null);
        setDeletingId(null);
      }
    };
    doDelete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteEndpoint]);

  const openConfirm = (conv, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (deleteLoading) return;
    setConfirmTarget(conv);
  };

  const cancelConfirm = (e) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (deleteLoading) return;
    setConfirmTarget(null);
  };

  const confirmDelete = (e) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!confirmTarget || deleteLoading) return;
    setDeletingId(confirmTarget.winningPairId);
    setDeleteEndpoint(`winning-pairs/${confirmTarget.winningPairId}/`);
    setConfirmTarget(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && confirmTarget) {
      cancelConfirm(e);
    }
  };

  useEffect(() => {
    if (confirmTarget) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [confirmTarget]);

  const visibleConversations = conversations?.filter(c => !removedIds.has(c.winningPairId)) || [];

  return (
    <div className="messages-dropdown" ref={panelRef} role="dialog" aria-label="Messages list">
      <div className="messages-dropdown-header">
        <h4 style={{ margin: 0, fontSize: 14 }}>Messages</h4>
        <button className="messages-dropdown-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="messages-dropdown-body" aria-live="polite">
        {isLoading && <div className="messages-dropdown-status">Loading...</div>}
        {error && <div className="messages-dropdown-error">{error}</div>}
        {!isLoading && !error && (
          visibleConversations.length ? (
            <div className="conversation-list">
              {visibleConversations.map((conv) => (
                <div
                  key={conv.id}
                  className="conversation-item"
                  onClick={() => onSelect(conv)}
                  role="button"
                  tabIndex={0}
                  style={{ textAlign: 'left', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', position: 'relative' }}
                >
                  <div className="conversation-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="conversation-user" style={{ fontWeight: 600, flexGrow: 1 }}>{conv.otherUserName}</span>
                    <span className="conversation-itemid" style={{ fontSize: 12, color: '#475569' }}>Item #{conv.itemId || conv.winningPairId}</span>
                    {conv.unreadCount > 0 && (
                      <span className="messages-badge" aria-label={`${conv.unreadCount} unread messages`}>{conv.unreadCount}</span>
                    )}
                    <button
                      aria-label="Delete conversation"
                      title="Delete conversation"
                      onClick={(e) => openConfirm(conv, e)}
                      disabled={deletingId === conv.winningPairId || deleteLoading}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, marginLeft: 4 }}
                    >
                      {deletingId === conv.winningPairId ? '…' : '🗑️'}
                    </button>
                  </div>
                  {conv.lastMessage && (
                    <div className="conversation-snippet" style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 4 }}>{conv.lastMessage}</div>
                  )}
                </div>
              ))}
              {visibleConversations.length === 0 && (
                <div className="messages-dropdown-status">No conversations.</div>
              )}
            </div>
          ) : (
            <div className="messages-dropdown-status">No conversations yet.</div>
          )
        )}
      </div>

      {confirmTarget && (
        <div
          className="messages-confirm-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-del-title"
          aria-describedby="confirm-del-desc"
          onClick={cancelConfirm}
        >
          <div
            className="messages-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h5 id="confirm-del-title" className="messages-confirm-title">Delete Conversation?</h5>
            <p id="confirm-del-desc" className="messages-confirm-text">
              This action hides the conversation for you. The other participant will still see it until they delete it too. This cannot be undone.
            </p>
            <div className="messages-confirm-actions">
              <button
                onClick={cancelConfirm}
                disabled={deleteLoading}
                className="messages-confirm-btn messages-confirm-cancel"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="messages-confirm-btn messages-confirm-delete"
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesDropdown;
