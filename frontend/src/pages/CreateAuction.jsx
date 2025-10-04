import { useState, useEffect, useRef } from "react";
import useApi from "../utils/UseApi";
import NamedDateTime from "../utils/NamedDateTime";
import NotificationPopup from "../components/NotificationPopup";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { CountryDropdown } from 'react-country-region-selector';
import "../styles/Auction_detail.css";

const CreateAuction = () => {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const categoryContainerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryContainerRef.current && !categoryContainerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [formValues, setFormValues] = useState({
    name: "",
    description: "",
    first_bid: "",
    buy_price: "",
    address: "",
    longitude: "",
    latitude: "",
    country: "",
    ends: "",
    started: "",
    main_image: null,
    additional_images: [],
    categories: [],
    publish_immediately: false,
  });

  const [imagePreview, setImagePreview] = useState({
    main_image: null,
    additional_images: [],
  });

  const [notification, setNotification] = useState({
    isVisible: false,
    message: "",
    type: "error",
  });


  const [categoryInput, setCategoryInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [disableCreate, setDisableCreate] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const { data: existingCategories } = useApi('categories/');

  const { data: createdItem, error: createError, isLoading: isCreating, refetch: createAuction } = useApi(
    "items/",
    "POST",
    null,
    false
  );

  // Watch for successful auction creation and redirect
  useEffect(() => {
    if (pendingRedirect && createdItem?.id && !createError) {
      console.log('Redirecting to auction:', createdItem.id);
      showNotification("Auction created successfully! Redirecting to your auction...", "success");
      setTimeout(() => navigate(`/home/auctions/${createdItem.id}`), 2000);
      setPendingRedirect(false);
    } else if (pendingRedirect && !isCreating && !createdItem?.id && !createError) {
      // If no ID but no error, go to homepage as failsafe
      showNotification("Auction created successfully! Redirecting to homepage...", "success");
      setTimeout(() => navigate("/home"), 2000);
      setPendingRedirect(false);
    }
  }, [createdItem, createError, isCreating, pendingRedirect, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCountryChange = (val) => {
    setFormValues((prev) => ({
      ...prev,
      country: val,
    }));
  };

  const handleCategoryInput = (e) => {
    const input = e.target.value;
    setCategoryInput(input);
    
    if (input.length > 0) {
      const filtered = existingCategories?.filter(cat => 
        cat.name.toLowerCase().includes(input.toLowerCase())
      ) || [];
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleDateChange = (name, value) => {
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMainImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormValues((prev) => ({ ...prev, main_image: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview((prev) => ({ ...prev, main_image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdditionalImagesChange = (e) => {
    const files = Array.from(e.target.files);
    setFormValues((prev) => ({ ...prev, additional_images: files }));
    const previews = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result);
        if (previews.length === files.length) {
          setImagePreview((prev) => ({ ...prev, additional_images: previews }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const addCategory = (categoryName) => {
    if (!formValues.categories.some(cat => cat.name === categoryName)) {
      setFormValues(prev => ({
        ...prev,
        categories: [...prev.categories, { name: categoryName }]
      }));
    }
    setCategoryInput('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleCategorySubmit = (e) => {
    if (e.key === 'Enter' && categoryInput.trim()) {
      e.preventDefault();
      addCategory(categoryInput.trim());
    }
  };

  const removeCategory = (categoryToRemove) => {
    setFormValues(prev => ({
      ...prev,
      categories: prev.categories.filter(cat => cat.name !== categoryToRemove.name)
    }));
  };

  const removeAdditionalImage = (index) => {
    setFormValues((prev) => ({
      ...prev,
      additional_images: prev.additional_images.filter((_, i) => i !== index),
    }));
    setImagePreview((prev) => ({
      ...prev,
      additional_images: prev.additional_images.filter((_, i) => i !== index),
    }));
  };

  const showNotification = (message, type = "error") => {
    setNotification({
      isVisible: true,
      message,
      type,
    });
  };
  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, isVisible: false }));
  };

  const createFormData = () => {
    const formData = new FormData();
    formData.append("name", formValues.name);
    formData.append("description", formValues.description);
    formData.append("first_bid", formValues.first_bid);
    if(formValues.buy_price){
      formData.append("buy_price", formValues.buy_price);
    }
    formData.append("address", formValues.address);
    if (formValues.longitude && formValues.latitude){
      formData.append("longitude", formValues.longitude);
      formData.append("latitude", formValues.latitude);
    }
    formData.append("country", formValues.country);
    formData.append("ends", formValues.ends instanceof Date ? formValues.ends.toISOString() : formValues.ends);
    if (formValues.publish_immediately){
      formData.append("publish_immediately", formValues.publish_immediately);
    }else{
      formData.append("started", formValues.started instanceof Date ? formValues.started.toISOString() : formValues.started);
    }

    formValues.categories.forEach(category => {
      formData.append('categories', category.name);
    });

    if (formValues.main_image) {
      formData.append("main_image", formValues.main_image);
    }
    formValues.additional_images.forEach((file) => {
      formData.append("uploaded_images", file);
    });
    return formData;
  };

  const handleSubmit = async (e) => {
    setDisableCreate(true);
    e.preventDefault();
    const { name, description, first_bid, address, country,
      ends, categories, started, publish_immediately, buy_price } = formValues;
    if (!name || !description || !first_bid || !address || !country || !ends) {
      showNotification("Fill in all required fields!", "error");
      setDisableCreate(false);
      return;
    }

    if (categories.length === 0){
      showNotification("Provide at least one category!", "error");
      setDisableCreate(false);
      return;
    }

    if (!started && !publish_immediately){
      showNotification("Set a starting date, or check the publish immediately box!", "error")
      setDisableCreate(false);
      return;
    }

    if (started instanceof Date){
      const today = new Date();

      if (started.getTime() <= today.getTime()){
        showNotification("Starting date must be after current time! If you want to publish immediately, " +
          "please check the publish_immediately button.", "error");
        setDisableCreate(false);
        return;
      }

      if (ends instanceof Date){
        if (started.getTime() >= ends.getTime){
          showNotification("Start date must be before end date!", "error");
          setDisableCreate(false);
          return;
        }
      }

      if (buy_price && buy_price < first_bid){
        showNotification("Buy should be higher than the first bid!", "error");
        setDisableCreate(false);
        return;
      }

    }

    const sendValues = createFormData();
    try {
      setPendingRedirect(true);
      await createAuction(sendValues);
      console.log('Created item data after call:', createdItem);
      // Success handling moved to useEffect
    } catch (error) {
      showNotification(`Create failed: ${error.message}`, "error");
      setPendingRedirect(false);
    }
    setDisableCreate(false);
  };

  if (isAuthLoading) {
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

  if (!isAuthenticated) {
    return (
      <div className="auction-detail-container">
        <div className="error-message">You must be logged in to create an auction.</div>
      </div>
    );
  }

  return (
    <div className="auction-detail-container">
      <h1>Create New Auction</h1>
      <form className="auction-detail-card" onSubmit={handleSubmit} encType="multipart/form-data">
        <div className="auction-image-section">
          <div className="image-upload-section">
            <div className="main-image-upload">
              <label htmlFor="main-image-input" className="image-upload-label">
                {imagePreview.main_image ? (
                  <img src={imagePreview.main_image} alt="Main preview" className="auction-main-image" />
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
                style={{ display: "none" }}
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
                style={{ display: "none" }}
              />
              {imagePreview.additional_images.length > 0 && (
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
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="auction-details-section">
          <div className="auction-header">
            <input
              type="text"
              name="name"
              value={formValues.name}
              onChange={handleChange}
              className="auction-title"
              placeholder="Auction Name"
              required
            />
          </div>
          <div className="auction-description">
            <h3>Description</h3>
            <textarea
              name="description"
              value={formValues.description}
              onChange={handleChange}
              className="edit-description"
              placeholder="Describe your item..."
              required
            />
          </div>
          <div className="categories-section">
            <h3>Categories</h3>
            <div className="categories-input-container" ref={categoryContainerRef}>
              <input
                type="text"
                value={categoryInput}
                onChange={handleCategoryInput}
                onKeyDown={handleCategorySubmit}
                placeholder="Type category and press Enter, or select from suggestions..."
                className="category-input"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="category-suggestions">
                  {suggestions.map(cat => (
                    <div
                      key={cat.id}
                      className="category-suggestion"
                      onClick={() => addCategory(cat.name)}
                    >
                      {cat.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="selected-categories">
              {formValues.categories.map((cat, index) => (
                <span key={index} className="category-tag">
                  {cat.name}
                  <button
                    type="button"
                    onClick={() => removeCategory(cat)}
                    className="remove-category"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="item-info-grid">
            <div className="pricing-info">
              <div className="price-item">
                <span className="price-label">🔨 First Bid:</span>
                <input
                  type="number"
                  name="first_bid"
                  value={formValues.first_bid}
                  onChange={handleChange}
                  className="edit-price-value"
                  placeholder="Starting bid"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="price-item">
                <span className="price-label">💰 Buy price: </span>
                <input
                  type="number"
                  name="buy_price"
                  value={formValues.buy_price}
                  onChange={handleChange}
                  className="edit-price-value"
                  placeholder="Buy Price"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="location-info">
              <div className="info-item">
                <span>Address:</span>
                <input
                  type="text"
                  name="address"
                  value={formValues.address}
                  onChange={handleChange}
                  className="edit-price-value"
                  placeholder="Address"
                  required
                />
              </div>
              <div className="info-item">
                <span>Country:</span>
                <CountryDropdown
                  value={formValues.country}
                  onChange={handleCountryChange}
                  valueType="short"
                  required
                  className="edit-price-value country-dropdown"
                />
              </div>
              <div className="price-item">
                <span className="price-label">Longitude: </span>
                <input
                  type="number"
                  name="longitude"
                  value={formValues.longitude}
                  onChange={handleChange}
                  className="edit-price-value"
                  placeholder="Longitude"
                  min="-180.00"
                  max="180.00"
                  step="0.01"
                />
              </div>
              <div className="price-item">
                <span className="price-label">Latitude: </span>
                <input
                  type="number"
                  name="latitude"
                  value={formValues.latitude}
                  onChange={handleChange}
                  className="edit-price-value"
                  placeholder="Latitude"
                  min="-90.00"
                  max="90.00"
                  step="0.01"
                />
              </div>
            </div>
            <div className="info-item">
              <span>End Date:</span>
              <NamedDateTime value={formValues.ends} onChange={handleDateChange} name="ends" required />
            </div>
            <div className="info-item">
              <span>Starting Date:</span>
              <NamedDateTime 
                value={formValues.started} 
                onChange={handleDateChange} 
                name="started" 
                required={!formValues.publish_immediately}
                disabled={formValues.publish_immediately}
              />
            </div>
            <div className="info-item">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  name="publish_immediately"
                  checked={formValues.publish_immediately}
                  onChange={(e) => {
                    setFormValues(prev => ({
                      ...prev,
                      publish_immediately: e.target.checked,
                      started: e.target.checked ? "" : prev.started
                    }))
                  }}
                />
                <span>Publish immediately</span>
              </label>
            </div>
          </div>
          <div className="edit-control-container">
            <button type="submit" className="save-button" disabled={disableCreate}>
              {disableCreate ? "Creating..." : "Create Auction"}
            </button>
            <button
              type="button"
              className="cancel-button"
              onClick={() => navigate(-1)}
              disabled={disableCreate}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
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

export default CreateAuction;