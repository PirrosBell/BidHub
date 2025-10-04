import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BACKEND_ADDRESS } from '../config';
import useApi from '../utils/UseApi';

const ChatWindow = ({ conversation, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [rawPayload, setRawPayload] = useState(null); 
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvingAuction, setResolvingAuction] = useState(false);
  const [auctionError, setAuctionError] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const bottomRef = useRef(null);
  const messagesRef = useRef([]);
  const navigate = useNavigate();

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const { refetch: rateWinningPair } = useApi(
    `winning-pairs/${conversation.winningPairId}/rate/`,
    "POST",
    null,
    false
  );


  const authFetch = async (url, options = {}) => {
    const accessToken = localStorage.getItem('accessToken');
    const cfg = {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      },
      credentials: 'include',
    };
    const res = await fetch(url, cfg);
    if (res.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        const r = await fetch(`${BACKEND_ADDRESS}token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ refresh: refreshToken }),
        });
        if (r.ok) {
          const data = await r.json();
          if (data?.access) {
            localStorage.setItem('accessToken', data.access);
            return fetch(url, {
              ...options,
              headers: { ...cfg.headers, Authorization: `Bearer ${data.access}` },
              credentials: 'include',
            });
          }
        }
      }
    }
    return res;
  };

  const normalizeMessageList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.results)) return payload.results;
    return [];
  };

  const markIncomingAsRead = async (list) => {
    if (!Array.isArray(list) || !conversation) return;
    const unread = list.filter(m => m?.recipient?.id === conversation.meId && !m?.is_read);
    if (!unread.length) return;
    try {
      await Promise.all(unread.map(m => authFetch(`${BACKEND_ADDRESS}messages/${m.id}/`)));
    } catch {}
  };

  useEffect(() => {
    const load = async () => {
      if (!conversation?.winningPairId) return;
      setIsLoading(true);
      setError(null);
      try {
        const url = `${BACKEND_ADDRESS}messages/?winning_pair=${conversation.winningPairId}`;
        const res = await authFetch(url);
        if (!res.ok) throw new Error(`Failed to load messages (${res.status})`);
        let data = null;
        try { data = await res.json(); } catch { data = null; }
        setRawPayload(data);
        const arr = normalizeMessageList(data);
        setMessages(arr);
        markIncomingAsRead(arr);
      } catch (e) {
        setError(e.message);
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [conversation?.winningPairId]);

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !conversation?.winningPairId) return;
    try {
      const payload = {
        winning_pair: conversation.winningPairId,
        sender: conversation.meId,
        recipient: conversation.otherUserId,
        content: text,
      };
      const res = await authFetch(`${BACKEND_ADDRESS}messages/`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = `Failed to send (${res.status})`;
        try { const e = await res.json(); msg = e.detail || e.error || JSON.stringify(e); } catch {}
        throw new Error(msg);
      }
      const saved = await res.json();
      setMessages((prev) => Array.isArray(prev) ? [...prev, saved] : [saved]);
      setInput('');
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (!conversation?.winningPairId) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const url = `${BACKEND_ADDRESS}messages/?winning_pair=${conversation.winningPairId}`;
        const res = await authFetch(url);
        if (!res.ok) return;
        let data = null;
        try { data = await res.json(); } catch { data = null; }
        const arr = normalizeMessageList(data);
        const current = messagesRef.current;
        const lastIdCurrent = Array.isArray(current) ? current[current.length - 1]?.id : undefined;
        const lastIdNew = arr[arr.length - 1]?.id;
        if (lastIdCurrent !== lastIdNew || (Array.isArray(current) && current.length !== arr.length)) {
          setMessages(arr);
          markIncomingAsRead(arr);
        }
      } catch {}
    };

    poll();
    const iv = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [conversation?.winningPairId]);

  useEffect(() => {
    const check = () => {
      if (!localStorage.getItem('accessToken')) {
        onClose && onClose();
      }
    };
    const iv = setInterval(check, 1000);
    const handleStorage = (e) => {
      if (e.key === 'accessToken' && !e.newValue) onClose && onClose();
    };
    window.addEventListener('storage', handleStorage);
    return () => { clearInterval(iv); window.removeEventListener('storage', handleStorage); };
  }, [onClose]);

  const resolveAndGoToAuction = async () => {
    if (resolvingAuction) return;
    setAuctionError(null);
    setResolvingAuction(true);
    try {
      if (conversation?.itemId) {
        navigate(`/home/auctions/${conversation.itemId}`);
        return;
      }
      const res = await authFetch(`${BACKEND_ADDRESS}winning-pairs/`);
      if (!res.ok) throw new Error('Failed to fetch winning pairs');
      let data = [];
      try { data = await res.json(); } catch { data = []; }
      if (!Array.isArray(data) || !data.length) throw new Error('No related auctions found');
      const meId = conversation.meId;
      const otherId = conversation.otherUserId;
      const related = data.filter(wp => {
        const sellerUser = wp.item?.seller?.user_id || wp.item?.seller?.id;
        const bidderUser = wp.winning_bidder?.user_id || wp.winning_bidder?.id;
        return (
          (sellerUser === meId && bidderUser === otherId) ||
          (sellerUser === otherId && bidderUser === meId)
        );
      });
      if (!related.length) throw new Error('No shared auctions with this user');
      related.sort((a,b) => {
        const aEnds = new Date(a.item?.ends || 0).getTime();
        const bEnds = new Date(b.item?.ends || 0).getTime();
        if (aEnds === bEnds) return (b.id || 0) - (a.id || 0);
        return bEnds - aEnds;
      });
      const target = related[0];
      if (!target?.item?.id) throw new Error('Auction ID missing');
      navigate(`/home/auctions/${target.item.id}`);
    } catch (e) {
      setAuctionError(e.message);
    } finally {
      setResolvingAuction(false);
    }
  };

  const submitRating = async () => {
    if (rating === 0) return;
    setSubmittingRating(true);
    try {
      setShowRatingModal(false);
      await rateWinningPair({'rating': rating})
      setShowSuccessModal(true);
      setRating(0);
    } catch (e) {
      setAuctionError(e.message);
    } finally {
      setSubmittingRating(false);
    }
  };

  if (!conversation) return null;

  const safeMessages = Array.isArray(messages) ? messages : [];

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-title">Chat with {conversation.otherUserName || 'User'}</div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <button
            type="button"
            className="chat-auction-btn"
            onClick={resolveAndGoToAuction}
            disabled={resolvingAuction}
            title="Go to related auction"
            style={{ background:'#3b82f6', color:'#fff', border:'none', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:12 }}
          >
            {resolvingAuction ? '...' : 'View Auction'}
          </button>
          <button
            type="button"
            className="chat-rating-btn"
            onClick={() => setShowRatingModal(true)}
            title="Rate this user"
            style={{ background:'#f59e0b', color:'#fff', border:'none', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:12 }}
          >
            Rate User
          </button>
          <button className="chat-close" onClick={onClose}>✕</button>
        </div>
      </div>
      {auctionError && (
        <div style={{ background:'#fef2f2', color:'#b91c1c', padding:'4px 8px', fontSize:12 }}>{auctionError}</div>
      )}
      <div className="chat-messages">
        {isLoading ? (
          <div className="chat-status">Loading...</div>
        ) : error ? (
          <div className="chat-error">{error}</div>
        ) : safeMessages.length === 0 ? (
            <div className="chat-status">No messages yet.</div>
        ) : (
          safeMessages.map((m) => {
            const senderId = (m && typeof m.sender === 'object') ? m.sender.id : m?.sender;
            const isMine = senderId === conversation.meId;
            return (
              <div key={m.id || Math.random()} className={`chat-message ${isMine ? 'from-me' : 'from-them'}`}>
                <div className="chat-bubble">
                  <div className="chat-content">{m?.content ?? ''}</div>
                  {m?.sent_at && <div className="chat-time">{new Date(m.sent_at).toLocaleString()}</div>}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={send}>
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!conversation?.winningPairId}
        />
        <button type="submit" disabled={!conversation?.winningPairId}>Send</button>
      </form>
      {rawPayload && !Array.isArray(rawPayload) && !Array.isArray(rawPayload?.results) && (
        <div style={{ padding: 6, background: '#fff7ed', borderTop: '1px solid #fed7aa', maxHeight: 80, overflow: 'auto' }}>
          <code style={{ fontSize: 10 }}>Unexpected payload shape</code>
        </div>
      )}

      {showRatingModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1300,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, minWidth: 300,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', textAlign: 'center' }}>Rate this Auction</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '16px 0' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 28, color: rating >= star ? '#fbbf24' : '#d1d5db'
                  }}
                  title={`${star} star${star > 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
              <button
                onClick={() => { setShowRatingModal(false); setRating(0); }}
                style={{
                  padding: '8px 16px', border: '1px solid #d1d5db', background: '#fff',
                  borderRadius: 6, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitRating}
                disabled={rating === 0 || submittingRating}
                style={{
                  padding: '8px 16px', border: 'none', background: rating === 0 ? '#d1d5db' : '#3b82f6',
                  color: '#fff', borderRadius: 6, cursor: rating === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {submittingRating ? 'Submitting...' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1300,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, minWidth: 300,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#059669' }}>Rating Submitted</h3>
            <p style={{ margin: '0 0 20px 0', color: '#6b7280' }}>
              Ratings cannot be changed once submitted.
            </p>
            <button
              onClick={() => setShowSuccessModal(false)}
              style={{
                padding: '8px 16px', border: 'none', background: '#3b82f6',
                color: '#fff', borderRadius: 6, cursor: 'pointer'
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
