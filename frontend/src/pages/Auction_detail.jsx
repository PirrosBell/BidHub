import React, { useState, useEffect } from 'react';
import useApi from "../utils/UseApi";
import "../styles/Auction_detail.css";
import { useParams, useNavigate, data, redirect } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';
import { formatPrice, formatDateString, formatTimeRemaining } from '../utils/utils';
import Datetime from 'react-datetime';
import NamedDateTime from '../utils/NamedDateTime';
import { CountryDropdown } from 'react-country-region-selector';
import NotificationPopup from '../components/NotificationPopup';

const AuctionDetail = () => {
  const { user, isLoading: isAuthLoading} = useAuth();
  const { id } = useParams();
  const [disableSave, setDisableSave] = useState(false);
  const [disableDelete, setDisableDelete] = useState(false);
  const navigate = useNavigate();
  const [showMap, setShowMap] = useState(false);
  const { data: item, error, isLoading, refetch } = useApi(`items/${id}/`);
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteImages, setDeleteImages] = useState([]);
  const [bidAmount, setBidAmount] = useState('');
  const [showBidForm, setShowBidForm] = useState(false);
  const [disableBid, setDisableBid] = useState(false);
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState(null);
  const [isBidderModalOpen, setIsBidderModalOpen] = useState(false);
  const [selectedBidderId, setSelectedBidderId] = useState(null);


  const { 
    error: bidError, 
    isLoading: isBidding, 
    refetch: submitBid 
  } = useApi(
    'bids/',             
    'POST',
    null,                
    false                
  );

  const { data, error: deleteError, isLoading: isDeleted, refetch: deleteItem } = useApi(
    `items/${id}/`,  
    'DELETE',
    null,               
    false                
  );

  const { data: sellerDetails, isLoading: sellerLoading, error: sellerError } = useApi(
    selectedSellerId ? `sellers/${selectedSellerId}/` : null,
    'GET',
    null,
    !!selectedSellerId
  );

  const { data: bidderDetails, isLoading: bidderLoading, error: bidderError } = useApi(
    selectedBidderId ? `bidders/${selectedBidderId}/` : null,
    'GET',
    null,
    !!selectedBidderId
  );

  useEffect(() => {
    if (!isSellerModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeSellerModal();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isSellerModalOpen]);

  const [notification, setNotification] = useState({
    isVisible: false,
    message: '',
    type: 'error'
  });

  const [editValues, setEditValues] = useState({
    name: "",
    description: "",
    buy_price: "",
    first_bid: "",
    address: '',
    longitude: undefined,
    latitude: undefined,
    started: "",
    ends: "",
    country: "",
    publish_immediately: false,
  });

  const [startingValues, setStartingValues] = useState({
    name: "",
    description: "",
    buy_price: "",
    first_bid: "",
    address: "",
    longitude: undefined,
    latitude: undefined,
    started: "",
    ends: "",
    country: "",
  });

  const [imageFiles, setImageFiles] = useState({
    main_image: null,
    additional_images: []
  });
  const [imagePreview, setImagePreview] = useState({
    main_image: null,
    additional_images: []
  });

  const [existingAdditionalImages, setExistingAdditionalImages] = useState([])


  const initializeExistingImages = () => {
    const starting_images = [];

    item.additional_images.forEach(element => {
      starting_images.push({id: element.id, image: element.image});
    });

    setExistingAdditionalImages(starting_images);
  }

  useEffect( () => {
    if(!isLoading && item){
      initializeExistingImages();

      const newStartingValues = {
        name: item.name || "",
        description: item.description || "",
        buy_price: parseFloat(item.buy_price) || "",
        first_bid: parseFloat(item.first_bid) || "",
        address: item.location?.address || "",
        longitude: item.location?.longitude || undefined,
        latitude: item.location?.latitude || undefined,
        started: item.started ? new Date(item.started) : "",
        ends: item.ends ? new Date(item.ends) : "",
        country: item.country || "",
      }; 

      setStartingValues(newStartingValues);
      setEditValues(newStartingValues);
    }
      
  },[item, isLoading])
  const [isEditing, setIsEditing] = useState(false);

  let sendValues = {}

  const {
    error: updateError,
    isLoading: isUpdating,
    refetch: sendUpdate
  } = useApi(
    `items/${id}/`,
    "PATCH",
    sendValues,
    false
  );

  const canUserBid = () => {
    return user &&
          user.seller_id !== item.seller.id &&
          item.status === 'active';
  };


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

  const startEditing = () => {
    setEditValues(startingValues);
    setIsEditing(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setEditValues((prev) => {
      return{
        ...prev,
        [name]: value,
      };
    });
  };

  const handleMainImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFiles(prev => ({ ...prev, main_image: file }));
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(prev => ({ ...prev, main_image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdditionalImagesChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(prev => ({ ...prev, additional_images: files }));
    
    const previews = [];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result);
        if (previews.length === files.length) {
          setImagePreview(prev => ({ ...prev, additional_images: previews }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAdditionalImage = (index) => {
    setImageFiles(prev => ({
      ...prev,
      additional_images: prev.additional_images.filter((_, i) => i !== index)
    }));
    setImagePreview(prev => ({
      ...prev,
      additional_images: prev.additional_images.filter((_, i) => i !== index)
    }));
  };

  const removeExistingAdditionalImage = (img) =>{
    setDeleteImages((prev)=>([...prev, img]));
    setExistingAdditionalImages((prev)=>(prev.filter((map) => map.id !== img.id)));
  }

  const handleDateChange = (name, value) => {
    setEditValues((prev) => ({ ...prev, [name]: value}));
  }

  const createFormData = () => {
    const formData = new FormData();

    for (const [key, value] of Object.entries(editValues)){
      if ((startingValues[key]) && (String(startingValues[key]) === String(value)))
        continue;

      if (key === 'address' || key === 'longitude' || key === 'latitude'){
        if (key === 'address' && value !== startingValues[key]) {
          formData.append('address', value);
        }
        if (key === 'longitude' && value !== startingValues[key]) {
          formData.append('longitude', value);
        }
        if (key === 'latitude' && value !== startingValues[key]) {
          formData.append('latitude', value);
        }
        continue;
      }

      if (value instanceof Date){
        formData.append(key, value.toISOString());
        continue;
      }

      formData.append(key, value);
    }

    if (imageFiles.main_image) {
      formData.append('main_image', imageFiles.main_image);
    }

    imageFiles.additional_images.forEach((file, index) => {
      formData.append(`additional_images`, file);
    });

    if (deleteImages.length > 0){
      deleteImages.forEach((img) => {
        formData.append(`delete_images`, img.id);
      });
    }
    return formData;
  };

  const handleSave = async () => {
    setDisableSave(true);
    
    sendValues = createFormData();
    
    console.log('sendValues contents:');
    for (let [key, value] of sendValues.entries()) {
      console.log(key, value);
    }


    try {
      
      await sendUpdate(sendValues);
      setIsEditing(false);
      setImageFiles({ main_image: null, additional_images: [] });
      setImagePreview({ main_image: null, additional_images: [] });
      refetch();
      if(updateError){
        showNotification(`Update error: ${updateError}`, 'error');
      }else{
        showNotification('Auction updated successfully!', 'success');
      }
      } catch (error) {
      console.error('Update error:', error);
      showNotification(`Update failed: ${error.message}`, 'error');
    }

    setDisableSave(false);
  };

  const handleBidSubmit = async () => {
    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      showNotification('Please enter a valid bid amount', 'error');
      return;
    }

    const minimumBid = item.current_bid ? 
      parseFloat(item.current_bid) + 0.01 : 
      parseFloat(item.first_bid);

    if (parseFloat(bidAmount) < minimumBid) {
      showNotification(`Bid must be at least ${formatPrice(minimumBid)}`, 'error');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to place a bid of ${formatPrice(bidAmount)}?`);
    if (!confirmed) {
      return;
    }

    setDisableBid(true);

    const bidData = {
      item: parseInt(id),   
      amount: parseFloat(bidAmount)
    };

    try {
      await submitBid(bidData);
      refetch();
      showNotification('Bid placed successfully!', 'success');
      setBidAmount('');
      setShowBidForm(false);
      
    } catch (error) {
      console.error('Bid error:', error);
      showNotification(`Bid failed: ${error.message}`, 'error');
    }

    setDisableBid(false);
  };

  const handleDelete = async () => {
    setDisableDelete(true);
    const body = { ids: [id] };
    try {
      await deleteItem(body);
      if(deleteError){
        showNotification(`Delete failed, ${deleteError}`, 'error');
      }else{
        showNotification('Auction deleted successfully!', 'success');
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      navigate('/home')
    } catch (err) {
      showNotification(`Delete failed: ${err}`, 'error');
    }
    setDisableDelete(false);
  };

  const openSellerModal = (sellerId) => {
    setSelectedSellerId(sellerId);
    setIsSellerModalOpen(true);
  };
  const closeSellerModal = () => {
    setIsSellerModalOpen(false);
    setSelectedSellerId(null);
  };

  const openBidderModal = (bidderId, e) => {
    if (e) e.stopPropagation();
    setSelectedBidderId(bidderId);
    setIsBidderModalOpen(true);
  };
  const closeBidderModal = () => {
    setIsBidderModalOpen(false);
    setSelectedBidderId(null);
  };

  if (isLoading || isAuthLoading) {
    return (
      <div className="auction-detail-container">
        <div className="loading-skeleton">
          <div className="skeleton-image"></div>
          <div className="skeleton-content">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-subtitle"></div>
            <div className="skeleton-line skeleton-small"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="auction-detail-container">
        <div className="error-message">Error: {error || "Item not found"}</div>
        <button className="back-button" onClick={() => navigate(-1)}>Back</button>
      </div>
    );
  }

  return (
    <div className="auction-detail-container">
      <button className="back-button" onClick={() => navigate(-1)}>← Return To List Of Auctions</button>
      <div className="auction-detail-card">
        <div className="auction-image-section">
          {isEditing ? (
            <div className="image-upload-section">
              <div className="main-image-upload">
                <label htmlFor="main-image-input" className="image-upload-label">
                  {imagePreview.main_image ? (
                    <img src={imagePreview.main_image} alt="Main preview" className="auction-main-image" />
                  ) : item.main_image ? (
                    <img src={item.main_image} alt={item.name} className="auction-main-image" />
                  ) : (
                    <div className="auction-image-placeholder">
                      <span className="image-placeholder-icon">🏷️</span>
                      <p>Click to upload main image</p>
                    </div>
                  )}
                </label>
                <input
                  id="main-image-input"
                  type="file"
                  accept="image/*"
                  onChange={handleMainImageChange}
                  style={{ display: 'none' }}
                />
              </div>

              <div className="additional-images-upload">
                <label htmlFor="additional-images-input" className="additional-upload-label">
                  📷 Add Additional Images
                </label>
                <input
                  id="additional-images-input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAdditionalImagesChange}
                  style={{ display: 'none' }}
                />
                
                {(imagePreview.additional_images.length > 0 || existingAdditionalImages.length > 0) && (
                  <div className="additional-previews">
                    {imagePreview.additional_images.map((preview, index) => (
                      <div key={index} className="additional-preview">
                        <img src={preview} alt={`Additional ${index + 1}`} />
                        <button
                          type="button"
                          onClick={() => removeAdditionalImage(index)}
                          className="remove-image-btn"
                        >
                          ✖
                        </button>
                      </div>
                    ))}
                    {existingAdditionalImages.map(data => (
                      
                      <div key={data.id} className="additional-preview">
                        <img src={data.image} alt={`Additional ${data.id + 1}`} />
                        <button
                          type="button"
                          onClick={() => removeExistingAdditionalImage(data)}
                          className="remove-image-btn"
                        >
                          ✖
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {item.main_image ? (
                <img src={item.main_image} alt={item.name} className="auction-main-image" />
              ) : (
                <div className="auction-image-placeholder">
                  <span className="image-placeholder-icon">🏷️</span>
                </div>
              )}

              {item.additional_images && item.additional_images.length > 0 && (
                <div className="auction-additional-images">
                  {item.additional_images.map(img => (
                    <img
                      key={img.id}
                      src={img.image}
                      alt={img.alt_text || item.name}
                      className="auction-additional-image"
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {user && (
            <div className='action-buttons'>
              {canUserBid() && (
                <div className='bid-section'>
                  {!showBidForm ? (
                    <button 
                      className='bid-button' 
                      onClick={() => setShowBidForm(true)}
                      disabled={item.status !== 'active'}
                    >
                      Place Bid
                    </button>
                  ) : (
                    <div className='bid-form'>
                      <div className='bid-input-container'>
                        <input
                          type="number"
                          placeholder={`Min: ${formatPrice(
                            item.current_bid ? 
                              parseFloat(item.current_bid) + 0.01 : 
                              item.first_bid
                          )}`}
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          className="bid-input"
                          min={item.current_bid ? 
                            parseFloat(item.current_bid) + 0.01 : 
                            item.first_bid}
                          step="0.01"
                          disabled={disableBid}
                        />
                        <div className='bid-form-buttons'>
                          <button 
                            className={disableBid ? 'disabled-submit-bid-button' : 'submit-bid-button'}
                            onClick={handleBidSubmit}
                            disabled={disableBid || !bidAmount}
                          >
                            {disableBid ? 'Bidding...' : 'Submit Bid'}
                          </button>
                          <button 
                            className='cancel-bid-button'
                            onClick={() => {
                              setShowBidForm(false);
                              setBidAmount('');
                            }}
                            disabled={disableBid}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {user.seller_id === item.seller.id && (
                <div className='owner-buttons'>
                  {!isEditing && (
                    <button 
                      className={disableDelete ? 'disabled-delete-button' : 'delete-button'} 
                      onClick={handleDelete} 
                      disabled={disableDelete}
                    >
                      Delete
                    </button>
                  )}
                  {!isEditing && (
                    <button className='edit-button' onClick={startEditing}>
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="auction-details-section">
          <div className="auction-header">
            {isEditing ? (
              <input
                type="text"
                name="name"
                value={editValues.name}
                onChange={handleChange}
                className="auction-title-edit"
              />
            ) : (
              <h2 className="auction-title">{item.name}</h2>
            )}
            <span className={`status-badge status-${item.status?.toLowerCase() || 'unknown'}`}>
              {item.status || 'Unknown'}
            </span>
          </div>

          <div className="auction-description">
            <h3>Description</h3>
            {isEditing ? (
              <textarea
                name="description"
                value={editValues.description}
                onChange={handleChange}
                className="edit-description"
              />
            ) : (
              <p>{item.description}</p>
            )}
          </div>

          <div className="item-info-grid">
            <div className="pricing-info">
              {isEditing && (
                <div className='price-item'>
                  <span className="price-label">🔨 First Bid:</span>
                  <input
                    type="number"
                    name="first_bid"
                    value={editValues.first_bid}
                    onChange={handleChange}
                    className="edit-price-value"
                    min="0"
                   step="0.01"
                  />
                </div>
              )}
              {isEditing ? (
                <div className="price-item">
                  <span className="price-label">💰 Buy Now:</span>
                  <input
                    type="number"
                    name="buy_price"
                    value={editValues.buy_price}
                    onChange={handleChange}
                    className="edit-price-value"
                    min="0"
                    step="0.01"
                  />
                </div>
              ) : (
                item.buy_price && (
                  <div className="price-item">
                    <span className="price-label">💰 Buy Now:</span>
                    <span className="price-value">{formatPrice(item.buy_price)}</span>
                  </div>
                )
              )}
              {item.current_bid && (
                <div className="price-item">
                  <span className="price-label">🔨 Current Bid:</span>
                  <span className="price-value">{formatPrice(item.current_bid)}</span>
                </div>
              )}
            </div>
            {isEditing ? (
              <div className='location-info'>
                <div className='info-item'>Edit Address:
                  <input
                  type="text"
                  name="address"
                  value={editValues.address}
                  onChange={handleChange}
                  className="edit-price-value"
                  />
                </div>
                <div className='info-item'>Longitude(Optional):
                  <input
                  type="number"
                  name="longitude"
                  value={editValues.longitude}
                  onChange={handleChange}
                  className="edit-price-value"
                  min="-90.00"
                  max="90.00"
                  step="0.01"
                  />
                </div>
                <div className='info-item'>Latitude(Optional):
                  <input
                  type="number"
                  name="latitude"
                  value={editValues.latitude}
                  onChange={handleChange}
                  className="edit-price-value"
                  min="-180.00"
                  max="180.00"
                  step="0.01"
                  />
                </div>
                <div className='info-item'>Country:
                  <CountryDropdown
                    value={editValues.country}
                    onChange={(val)=>{
                      handleDateChange('country', val);
                    }}
                    valueType="short"
                    className='edit-price-value country-dropdown'
                  />
                </div>
              </div>
            ) : (
              <div className="location-info">
                <div className="info-item">
                  <span className="info-icon">📍</span>
                  <span>{item.location?.address}, {item.country}</span>
                </div>
              </div>
              )}
            
            {isEditing ?(
              <div className="location-info">
                <div className="info-item">
                  <span>Edit Start Date:</span>
                    <NamedDateTime 
                    value={editValues.started} 
                    onChange={handleDateChange} 
                    name="started" 
                    required={!editValues.publish_immediately}
                    disabled={editValues.publish_immediately}
                  />              
                </div>
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    name="publish_immediately"
                    checked={editValues.publish_immediately}
                    onChange={(e) => {
                      setEditValues(prev => ({
                        ...prev,
                        publish_immediately: e.target.checked,
                        started: e.target.checked ? startingValues.started : prev.started
                      }))
                    }}
                  />
                  <span>Publish</span>
              </label>
              </div>
            ) : (
              <div className="info-item">
                <span className="info-icon">⏰ Started:</span>
                <span className='price-value'> {item.started ? new Date(item.started).toLocaleString() : 'N/A'}</span>
              </div>
            )}

            {isEditing ? (
              <div className="info-item">
                <span>Edit End Date:</span>
                <NamedDateTime value={editValues.ends} onChange={handleDateChange} name='ends'/>
              </div>
            ):( 
              <div className="info-item">
                <span className="info-icon">🕒 Ends In:</span>
                <span className="price-value">{formatTimeRemaining(item.ends)}</span>
              </div>
            )}
          </div>

          { !isEditing && item.location?.latitude && item.location?.longitude && (
                <div className="map-box">
                  <button 
                    className="map-button"
                    onClick={() => setShowMap(true)}
                  >
                    🌍 Show on Map
                  </button>
                </div>
          )}

          {isEditing && (
            <div className='edit-control-container'>
              <button className={disableSave? 'disabled-save-button' : 'save-button'} onClick={handleSave} disabled={disableSave}>
                Save</button>
              <button className='cancel-button' onClick={() => {
                setIsEditing(false);
                console.log(deleteImages);
                console.log(existingAdditionalImages);
                initializeExistingImages();
                setDeleteImages([]);
                }}
                >Cancel</button>
            </div>
          )}

          {!isEditing && item.seller && (
            <div className="seller-info">
              <h4>Seller</h4>
              <div>
                Seller: <button className="seller-link" onClick={() => openSellerModal(item.seller.id)}>{item.seller.username}</button><br />
                Rating: {item.seller.avg_rating} ({item.seller.rating_count} ratings)
              </div>
            </div>
          )}

          {!isEditing && user && (user.seller_id == item.seller.id) && (
            <div className="expandable-section" >
              <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className='expandable-header'
              >
                <span></span>
                <span>Bids</span>
                <svg 
                className={`arrow-icon ${isExpanded ? 'expanded' : ''}`}
                fill="black" 
                stroke="black" 
                viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M19 9 l-7 7 l-7-7 l+14 0" 
                  />
                </svg>
              </button>
              <div className={`expandable-content ${isExpanded ? 'expanded' : ''}`}>
                <div className="bid-content-wrapper">
                  {item.bids.length > 0 ?  (item.bids.map((bid) => (
                    <div key={bid.id} className="bid">
                      <div className="bid-content">
                        <div className="bid-info">
                          <button
                            className="bidder-link"
                            onClick={(e)=>openBidderModal(bid.bidder.id, e)}
                          >{bid.bidder.username}</button> : {formatPrice(bid.amount)}
                        </div>
                        <span className="bid-time">{formatDateString(bid.time)}</span>
                      </div>
                      <hr/>
                    </div>
                  ))) : (
                    <span className='no-bids'>Nobody has bidded to your item yet</span>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {showMap && (
        <div className="map-popup-overlay">
          <div className="map-popup">
            <button className="map-close-button" onClick={() => setShowMap(false)}>✖</button>
            <iframe
              title="Item Location"
              width="100%"
              height="400"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              src={`https://www.google.com/maps?q=${item.location.latitude},${item.location.longitude}&z=15&output=embed`}
            ></iframe>
          </div>
        </div>
      )}

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

      {isBidderModalOpen && (
        <div className="modal-backdrop" onClick={closeBidderModal}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bidder-modal-title"
          >
            <div className="modal-header">
              <h3 id="bidder-modal-title">Bidder Details</h3>
              <button className="modal-close" onClick={closeBidderModal} aria-label="Close">✕</button>
            </div>
            <div className="modal-body">
              {bidderLoading && <div>Loading bidder...</div>}
              {bidderError && <div className="error-message">{bidderError}</div>}
              {bidderDetails && (
                <div className="seller-details">
                  <div className="seller-meta">
                    <div className="seller-name">{bidderDetails.username}</div>
                    <div className="seller-rating">⭐ {bidderDetails.avg_rating} ({bidderDetails.rating_count})</div>
                    {bidderDetails.country && (
                      <div className="seller-country">🌍 {bidderDetails.country}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <NotificationPopup
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={hideNotification}
        duration={5000}
        position="bottom-right"
        onClick={hideNotification} 
      />

    </div>
  );
};

export default AuctionDetail;