const Profiles = () => {
  
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState('ends');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [queryParams, setQueryParams] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    console.log('Filters changed')
    const params = new URLSearchParams();
    
    if (searchTerm) {
      params.append('search', searchTerm); 
    }
    
    if (filterCategory) {
      params.append('category', filterCategory);  
    }
    
    if (sortBy) {
      params.append('ordering', sortBy); 
    }

    const newParams = params.toString() ? `?${params.toString()}` : '';
    setQueryParams(newParams);
    setPage(1)
  }, [searchTerm, filterCategory, sortBy]);

  const endpoint = `items${queryParams}${queryParams ? `&page=${page}` : `?page=${page}`}`
  const { data: items, meta, error, isLoading } = useApi(endpoint);
  const { data: categories, cat_error, cat_loading } = useApi('categories/');



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

  const handleItemClick = (item) => {
    navigate(`/auctions/${item.id}`)
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
          </select>
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
                        <span key={category} className="category-tag">
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
                      Seller: {item.seller.username}
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
    </div>
  );
};

export default Profiles