import '../styles/ManageAuctions.css'
import React, { useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';
import useApi from '../utils/UseApi';
import '../styles/Auctions.css'

const ManageAuctions = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const sortBy = 'ends';
  const [queryParams, setQueryParams] = useState('');
  const [page, setPage] = useState(1);

  const endpoint = `sellers/my_items${queryParams ? `${queryParams}&page=${page}` : `?page=${page}`}`;
  const { data: items, meta, error, isLoading} = useApi(endpoint);

  useEffect(() =>{
    const params = new URLSearchParams();
    if (sortBy){
      params.append('ordering', sortBy);
    }
    const newParams = params.toString() ? `?${params.toString()}` : '';
    setQueryParams(newParams);
    setPage(1)
  }, [items]);

  if (error) return <div className="error-message">Error: {error}</div>;

  const handleItemClick = (item) =>{
    navigate(`/home/auctions/${item.id}`);
  }

  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  const formatTimeRemaining = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;
    if (diff <= 0) return 'Ended';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}m`;
  };

  if (isLoading){
    return(
      <div>
        <h1>Loading</h1>
      </div>
    )
  }

  return ( 
    <div className='manage-auctions-container'>
      <div className='above-line-container'>
        Your Auctions
        <div className='create-auction-button' onClick={() => navigate('/create_auction')}>
          Create Auction
        </div>
      </div>
      <hr/>
      <div className='below-line-container'>
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
      </div>
    </div>
    );
}
 
export default ManageAuctions;