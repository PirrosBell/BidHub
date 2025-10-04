import React, { useState } from 'react';
import Datetime from 'react-datetime';
import "react-datetime/css/react-datetime.css";
import moment from 'moment';
import "../styles/Auction_detail.css"

const NamedDateTime = ({ name, value, onChange, disabled = false }) => {
  const [selected, setSelected] = useState(value ? moment(value) : null);

  const handleChange = (newValue) => {
    if (disabled) return;
    
    setSelected(newValue);

    if (moment.isMoment(newValue) && newValue.isValid()) {
      onChange(name, newValue.toDate());
    }
  };

  return (
    <div style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <Datetime
        value={selected}
        onChange={handleChange}
        dateFormat="DD/MM/YYYY"
        timeFormat="HH:mm"
        inputProps={{ 
          disabled,
          className: "edit-price-value" }}
      />
    </div>
  );
};

export default NamedDateTime;