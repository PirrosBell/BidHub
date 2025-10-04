import React, { useState, useEffect } from 'react';
import useApi from "../utils/UseApi";
import "../styles/Auctions.css";
import { useNavigate } from 'react-router-dom';
import { formatPrice, formatDateString, formatTimeRemaining } from '../utils/utils';
import NotificationPopup from '../components/NotificationPopup';
import { useAuth } from '../contexts/AuthContext';
import { CountryDropdown } from 'react-country-region-selector';



const Auctions = () => {
  
  const { user, isLoading: isAuthLoading} = useAuth();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState('ends');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [queryParams, setQueryParams] = useState('');
  const [page, setPage] = useState(1);

  const [notification, setNotification] = useState({
    isVisible: false,
    message: '',
    type: 'error'
  });
  
  const showNotification = (message, type = 'error') => {
    setNotification({
      isVisible: true,
      message,
      type
    });
  };

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  };

  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState(null);

  // Admin export handlers
  const buildExportPayload = () => {
    if (!items || !Array.isArray(items)) return [];
    return items.map(it => ({
      id: it.id,
      name: it.name,
      description: it.description,
      categories: (it.categories || []).map(c => c.name),
      seller: it.seller?.username || null,
      current_bid: it.current_bid,
      first_bid: it.first_bid,
      number_of_bids: it.number_of_bids,
      country: it.country,
      location: it.location?.address || null,
      started: it.started,
      ends: it.ends,
      status: it.status,
    }));
  };

  const downloadBlob = (dataStr, filename, mime) => {
    const blob = new Blob([dataStr], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const payload = buildExportPayload();
    downloadBlob(JSON.stringify({ items: payload }, null, 2), 'auctions_export.json', 'application/json');
  };

  const escapeXML = (v) => (v == null ? '' : String(v)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;'));

  // Helper to format currency like $7.50
  const formatMoney = (val) => {
    if (val == null || val === '') return '';
    const num = Number(val);
    if (isNaN(num)) return escapeXML(String(val));
    return `$${num.toFixed(2)}`;
  };

  // Format date to Mon-DD-YY HH:MM:SS (e.g., Dec-10-01 08:21:26)
  const formatXMLDate = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return escapeXML(iso);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const mon = months[d.getUTCMonth()];
      const day = String(d.getUTCDate()).padStart(2,'0');
      const year = String(d.getUTCFullYear()).slice(-2);
      const hh = String(d.getUTCHours()).padStart(2,'0');
      const mm = String(d.getUTCMinutes()).padStart(2,'0');
      const ss = String(d.getUTCSeconds()).padStart(2,'0');
      return `${mon}-${day}-${year} ${hh}:${mm}:${ss}`;
    } catch {
      return escapeXML(iso);
    }
  };

  const exportXML = () => {
    const payload = buildExportPayload();

    const xmlItems = payload.map(p => {
      const original = (Array.isArray(items) ? items.find(it => it.id === p.id) : null) || {};
      const bids = Array.isArray(original.bids) ? original.bids : [];
      const seller = original.seller || {};

      const sellerRating = seller.rating_count != null ? seller.rating_count : (seller.avg_rating != null ? seller.avg_rating : '');
      const sellerUserID = seller.username || p.seller || '';

      const bidsXML = bids.length === 0
        ? '<Bids />'
        : `<Bids>\n${bids.map(b => {
            const bidder = b.bidder || {};
            const bidderRating = bidder.rating_count != null ? bidder.rating_count : (bidder.avg_rating != null ? bidder.avg_rating : '');
            const bidderUserID = bidder.username || '';
            const bidderLoc = bidder.location?.address || bidder.location || '';
            const bidderCountry = bidder.country || '';
            return `  <Bid>\n    <Bidder Rating="${escapeXML(bidderRating)}" UserID="${escapeXML(bidderUserID)}">\n      <Location>${escapeXML(bidderLoc)}</Location>\n      <Country>${escapeXML(bidderCountry)}</Country>\n    </Bidder>\n    <Time>${escapeXML(formatXMLDate(b.created || b.time))}</Time>\n    <Amount>${escapeXML(formatMoney(b.amount))}</Amount>\n  </Bid>`;
          }).join('\n')}\n</Bids>`;

      const indentedBidsXML = bidsXML.split('\n').map(l => l ? '    ' + l : l).join('\n');

      const parts = [];
      parts.push(`  <Item ItemID="${p.id}">`);
      parts.push(`    <Name>${escapeXML(p.name)}</Name>`);
      (p.categories || []).forEach(c => parts.push(`    <Category>${escapeXML(c)}</Category>`));
      parts.push(`    <Currently>${escapeXML(formatMoney(p.current_bid))}</Currently>`);
      if (p.buy_price != null) parts.push(`    <Buy_Price>${escapeXML(formatMoney(p.buy_price))}</Buy_Price>`);
      parts.push(`    <First_Bid>${escapeXML(formatMoney(p.first_bid))}</First_Bid>`);
      parts.push(`    <Number_of_Bids>${escapeXML(p.number_of_bids != null ? p.number_of_bids : bids.length)}</Number_of_Bids>`);
      parts.push(indentedBidsXML);
      parts.push(`    <Location>${escapeXML(p.location)}</Location>`);
      parts.push(`    <Country>${escapeXML(p.country)}</Country>`);
      parts.push(`    <Started>${escapeXML(formatXMLDate(p.started))}</Started>`);
      parts.push(`    <Ends>${escapeXML(formatXMLDate(p.ends))}</Ends>`);
      parts.push(`    <Seller Rating="${escapeXML(sellerRating)}" UserID="${escapeXML(sellerUserID)}" />`);
      parts.push(`    <Description>${escapeXML(p.description)}</Description>`);
      parts.push('  </Item>');
      return parts.join('\n');
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<AuctionExport>\n${xmlItems}\n</AuctionExport>`;
    downloadBlob(xml, 'auctions_export.xml', 'application/xml');
  };

  useEffect(() => {
    const params = new URLSearchParams();
    
    if (searchTerm) {
      params.append('search', searchTerm); 
    }
    
    if (filterCategory) {
      params.append('category', filterCategory);  
    }

    if (filterCountry){
      params.append('country', filterCountry);
    }
    
    if (sortBy) {
      if (sortBy=='recommended' && !user){
        showNotification('You need to have a user profile to have recommended items', 'error');
      } 
      params.append('ordering', sortBy); 
    }

    const newParams = params.toString() ? `?${params.toString()}` : '';
    setQueryParams(newParams);
    setPage(1);
  }, [searchTerm, filterCategory, sortBy, user, filterCountry]);

  const endpoint = `items${queryParams ? `${queryParams}&page=${page}` : `?page=${page}`}`;
  const { data: items, meta, error, isLoading} = useApi(endpoint);
  const { data: categories} = useApi('categories/');
  const { data: sellerDetails, isLoading: sellerLoading, error: sellerError } = useApi(
    selectedSellerId ? `sellers/${selectedSellerId}/` : null,
    'GET',
    null,
    !!selectedSellerId
  );

  useEffect(() => {
    if (!isSellerModalOpen) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') closeSellerModal(); };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isSellerModalOpen]);

  if (isLoading) {
    return (
      <div className="loading-skeleton-list">
        <div className="loading-skeleton">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton-item">
              <div className="skeleton-image"></div>
              <div className="skeleton-content">
                <div className="skeleton-line skeleton-title"></div>
                <div className="skeleton-line skeleton-subtitle"></div>
                <div className="skeleton-line skeleton-small"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) return <div className="error-message">Error: {error}</div>;

  const handleItemClick = (item) => {
    navigate(`${item.id}`)
  };

  const openSellerModal = (sellerId, e) => {
    e.stopPropagation();
    setSelectedSellerId(sellerId);
    setIsSellerModalOpen(true);
  };

  const closeSellerModal = () => {
    setIsSellerModalOpen(false);
    setSelectedSellerId(null);
  };

  return (
    <div className="item-list-container">
      <div className="filters-section">
        <div className="search-input-container">
          <input
            type="text"
            placeholder="Search items..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter'){
                setSearchTerm(searchInput);
              }
            }}
            className="search-input"
          />
          <button
            onClick={() => setSearchTerm(searchInput)}
            className="search-button"
          >Search
          </button>
        </div>
        <div className="filter-controls">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="filter-select"
          >
            <option value="">All Categories</option>
            {categories?.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <CountryDropdown
            value={filterCountry}
            onChange={(country) => setFilterCountry(country)}
            valueType="short"
            className="filter-select"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="ends">Ending Soon</option>
            <option value="name">Name</option>
            <option value="-buy_price">Buy Price (High to Low)</option>
            <option value="buy_price">Buy Price (Low to High)</option>
            <option value="-current_bid">Current Bid (High to Low)</option>
            <option value="current_bid">Current Bid (Low to High)</option>
            {user && (
              <option value="recommended">Recommended </option>
            )}
          </select>
          {user?.is_staff && (
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={exportJSON}
                disabled={!items || !items.length}
                className="search-button"
                style={{ background:'#e8f5e9', color:'#1b5e20' }}
              >Export JSON</button>
              <button
                type="button"
                onClick={exportXML}
                disabled={!items || !items.length}
                className="search-button"
                style={{ background:'#ffebee', color:'#b71c1c' }}
              >Export XML</button>
            </div>
          )}
        </div>
      </div>

      <div className="results-count">
        {items.length} {items.length === 1 ? 'item' : 'items'} found
      </div>

      <div className="items-grid">
        {items.length === 0 ? (
          <div className="no-items-message">
            <div className="no-items-icon">📦</div>
            <h3>No items found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="item-container"
              onClick={() => handleItemClick(item)}
            >
              <div className="item-content">
                <div className="item-image-container">
                  {item.main_image ? (
                    <img
                      src={item.main_image}
                      alt={item.name}
                      className="item-image"
                    />
                  ) : (
                    <div className="item-image-placeholder">
                      <span className="image-placeholder-icon">🏷️</span>
                    </div>
                  )}
                </div>

                <div className="item-details">
                  <div className="item-header">
                    <h3 className="item-name">{item.name}</h3>
                    <span className={`status-badge status-${item.status?.toLowerCase() || 'unknown'}`}>
                      {item.status || 'Unknown'}
                    </span>
                  </div>

                  {item.categories && item.categories.length > 0 && (
                    <div className="categories-container">
                      {item.categories.map((category) => (
                        <span key={`${item.id}-${category.id}`} className="category-tag">
                          {category.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="item-info-grid">
                    <div className="pricing-info">
                      {item.buy_price && (
                        <div className="price-item">
                          <span className="price-label">💰 Buy Now:</span>
                          <span className="price-value">{formatPrice(item.buy_price)}</span>
                        </div>
                      )}
                      {item.current_bid && (
                        <div className="price-item">
                          <span className="price-label">🔨 Current Bid:</span>
                          <span className="price-value">{formatPrice(item.current_bid)}</span>
                        </div>
                      )}
                    </div>
                    <div className="location-info">
                      <div className="info-item">
                        <span className="info-icon">📍</span>
                        <span>{item.location.address}, {item.country}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-icon">⏰</span>
                        <span>{formatTimeRemaining(item.ends)}</span>
                      </div>
                    </div>
                  </div>

                  {item.seller && (
                    <div className="seller-info">
                      Seller: <button className="seller-link" onClick={(e) => openSellerModal(item.seller.id, e)}>{item.seller.username}</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="pagination-controls">
        <button
          disabled={!meta?.previous}
          onClick={() => setPage(page - 1)}
        >
          Prev
        </button>

        <span>Page {page} of {Math.ceil((meta?.count || 0) / 50)}</span>

        <button
          disabled={!meta?.next}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>

      <NotificationPopup
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={hideNotification}
        duration={5000}
        position="bottom-right"
        onClick={hideNotification} 
      />

      {isSellerModalOpen && (
        <div className="modal-backdrop" onClick={closeSellerModal}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-modal-title"
          >
            <div className="modal-header">
              <h3 id="seller-modal-title">Seller Details</h3>
              <button className="modal-close" onClick={closeSellerModal} aria-label="Close">✕</button>
            </div>
            <div className="modal-body">
              {sellerLoading && <div>Loading seller...</div>}
              {sellerError && <div className="error-message">{sellerError}</div>}
              {sellerDetails && (
                <div className="seller-details">
                  <div className="seller-avatar">
                    <img
                      src={sellerDetails.profile?.profile_image_url || '/default-avatar.jpg'}
                      alt={sellerDetails.username}
                    />
                  </div>
                  <div className="seller-meta">
                    <div className="seller-name">{sellerDetails.username}</div>
                    <div className="seller-rating">⭐ {sellerDetails.avg_rating} ({sellerDetails.rating_count})</div>
                    {sellerDetails.country && (
                      <div className="seller-country">🌍 {sellerDetails.country}</div>
                    )}
                    {sellerDetails.profile?.bio && (
                      <div className="seller-bio">{sellerDetails.profile.bio}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auctions;