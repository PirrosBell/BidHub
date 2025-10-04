import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import NavigateButton from "./utils/NavigateButton";
import './styles/Layout.css';
import { SITE_NAME, BACKEND_ADDRESS } from "./config";
import { useEffect, useMemo, useState, useRef } from "react";
import useApi from "./utils/UseApi";
import MessagesModal from "./components/MessagesModal";
import ChatWindow from "./components/ChatWindow";
import './styles/Messaging.css';

const Layout = () => {
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  const navigate = useNavigate();

  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const messagesBtnRef = useRef(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [convExtras, setConvExtras] = useState({});
  const [unreadTotal, setUnreadTotal] = useState(0);
  const pollRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const { data: winningPairs, error: wpError, isLoading: wpLoading } = useApi(
    isAuthenticated ? 'winning-pairs/' : null,
    'GET',
    null,
    !!isAuthenticated
  );

  const conversations = useMemo(() => {
    if (!winningPairs || !user) return [];
    return winningPairs.map((wp) => {
      const sellerUser = wp.item?.seller?.user_id || wp.item?.seller?.userID || wp.item?.seller?.id;
      const sellerUsername = wp.item?.seller?.username || 'Seller';
      const bidderUser = wp.winning_bidder?.user_id || wp.winning_bidder?.userID || wp.winning_bidder?.id;
      const bidderUsername = wp.winning_bidder?.username || 'Bidder';
      const amISeller = user?.id === sellerUser;
      const otherUserId = amISeller ? bidderUser : sellerUser;
      const otherUserName = amISeller ? bidderUsername : sellerUsername;
      return {
        id: `wp-${wp.id}`,
        winningPairId: wp.id,
        itemId: wp.item?.id,
        meId: user?.id,
        otherUserId,
        otherUserName,
        lastMessage: null,
      };
    });
  }, [winningPairs, user]);

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

  const fetchConvMeta = async () => {
    if (!conversations?.length) return;
    try {
      const results = await Promise.all(
        conversations.map(async (c) => {
          try {
            const res = await authFetch(`${BACKEND_ADDRESS}messages/?winning_pair=${c.winningPairId}`);
            if (!res.ok) return [c.winningPairId, null];
            let data = [];
            try { data = await res.json(); } catch { data = []; }
            if (!Array.isArray(data)) {
              if (Array.isArray(data?.results)) data = data.results; else data = [];
            }
            const unreadMsgs = data.filter(m => {
              const recipientId = (m && typeof m.recipient === 'object') ? m.recipient?.id : m?.recipient;
              const isReadFlag = m?.is_read ?? m?.isRead;
              return recipientId === c.meId && (isReadFlag === false || isReadFlag === 0 || isReadFlag === null || typeof isReadFlag === 'undefined');
            });
            const unreadCount = unreadMsgs.length;
            const last = data[data.length - 1] || null;
            const snippet = last?.content ? (last.content.length > 80 ? `${last.content.slice(0, 77)}...` : last.content) : null;
            return [c.winningPairId, { lastMessage: snippet, lastMessageAt: last?.sent_at || null, unreadCount }];
          } catch (e) {
            console.warn('[Messaging] conversation meta fetch error', e);
            return [c.winningPairId, null];
          }
        })
      );
      const extras = {};
      results.forEach(([wpId, meta]) => { if (meta) extras[wpId] = meta; });
      const total = Object.values(extras).reduce((sum, m) => sum + (m.unreadCount || 0), 0);
      setConvExtras((prev) => ({ ...prev, ...extras }));
      setUnreadTotal(total);
      console.log('[Messaging] Unread total (DB is_read based) =', total, extras);
    } catch (e) {
      console.warn('[Messaging] meta aggregation failed', e);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchConvMeta();
  }, [isAuthenticated, isMessagesOpen, conversations]);

  useEffect(() => {
    console.log('[Messaging] unreadTotal changed:', unreadTotal);
  }, [unreadTotal]);

  useEffect(() => {
    if (!isAuthenticated || !conversations?.length) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchConvMeta, 20000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isAuthenticated, conversations]);

  const enrichedConversations = useMemo(() => {
    if (!conversations?.length) return conversations;
    return conversations.map((c) => ({
      ...c,
      ...(convExtras?.[c.winningPairId] || {}),
    }));
  }, [conversations, convExtras]);

  const openMessages = () => setIsMessagesOpen(true);
  const closeMessages = () => setIsMessagesOpen(false);

  const openChat = (conv) => {
    setActiveConversation(conv);
    setIsMessagesOpen(false);
  };

  const closeChat = () => setActiveConversation(null);

  return (
    <div className="layout-container">
      <header>
        <div className="left-navbar">
          <Link to="/"> {SITE_NAME}</Link>
          {isAuthenticated && (
            <button className="nav-button" ref={messagesBtnRef} onClick={openMessages}>
              Messages{unreadTotal > 0 && <span className="messages-dot" aria-label={`You have ${unreadTotal} unread messages`}></span>}
            </button>
          )}
        </div>
        <nav className="right-navbar">
          {isLoading ? (
            <span>Loading...</span>
          ) : isAuthenticated ? (
            <>
              {user?.is_staff && <NavigateButton to="/admin">Admin</NavigateButton>}
              <NavigateButton to="/home/auctions">Auctions</NavigateButton>
              <NavigateButton to="/create_auction">Post Auction</NavigateButton>
              <NavigateButton to="/profile">Profile ({user?.username})</NavigateButton>
              <button onClick={handleLogout} className="nav-button">Logout</button>
            </>
          ) : (
            <>
              <NavigateButton to="/home/auctions">Auctions</NavigateButton>
              {isAuthenticated ? (
            <>
              <div className="user-profile">
                <img 
                  src={user?.profile_image || '/default-avatar.jpg'} 
                  alt="Profile" 
                  className="profile-image"
                />
                <span className="username" onClick={() => navigate('/profile')}>{user?.username}</span>
              </div>
              <button onClick={handleLogout} className="logout-button">
                Logout
              </button>
            </>
          ) : (
            <>
              <NavigateButton to="/login">Login</NavigateButton>
                  <NavigateButton to="/register">Register</NavigateButton>
            </>
          )}
            </>
          )}
        </nav>
      </header>

      <div className="separator"/>
      
      <main>
        <Outlet/>
      </main>
      
      <div className="separator"/>
      
      <footer>
        <p>© 2025 Auction Site</p>
        <Link to="/about">About us</Link>
      </footer>

      <MessagesModal
        isOpen={isMessagesOpen}
        onClose={closeMessages}
        conversations={enrichedConversations}
        isLoading={wpLoading}
        error={wpError}
        onSelect={openChat}
        anchorRef={messagesBtnRef}
      />

      {activeConversation && (
        <ChatWindow conversation={activeConversation} onClose={closeChat} />
      )}
    </div>
  );
}

export default Layout;