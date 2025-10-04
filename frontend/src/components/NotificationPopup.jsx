import React, { useState, useEffect } from 'react';
import '../styles/NotificationPopup.css'

const NotificationPopup = ({ 
  message, 
  type = 'error', 
  duration = 5000, 
  isVisible, 
  onClose,
  onClick,
  actionText,
  onAction,
  position = 'bottom-right',
  showCloseButton = true,
  autoHide = true,
  icon
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      
      if (autoHide && duration > 0) {
        const timer = setTimeout(() => {
          handleClose();
        }, duration);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isVisible, duration, autoHide]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300);
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
    handleClose();
  };

  const getIcon = () => {
    if (icon) return icon;
    
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'error':
      default:
        return '❌';
    }
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`notification-popup ${type} ${position} ${isAnimating ? 'visible' : 'hidden'}`}
      onClick={handleClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="notification-content">
        <div className="notification-icon">
          {getIcon()}
        </div>
        
        <div className="notification-message">
          {message}
        </div>

        {actionText && onAction && (
          <button 
            className="notification-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleAction();
            }}
          >
            {actionText}
          </button>
        )}

        {showCloseButton && (
          <button 
            className="notification-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            aria-label="Close notification"
          >
            ✖
          </button>
        )}
      </div>

      {autoHide && duration > 0 && (
        <div 
          className="notification-progress-bar"
          style={{ 
            animationDuration: `${duration}ms`,
            animationPlayState: isVisible ? 'running' : 'paused'
          }}
        />
      )}
    </div>
  );
};

export default NotificationPopup;