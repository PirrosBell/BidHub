import React, { useState } from 'react';
import "../styles/Homepage.css";
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';


const Home = () => {
  const navigate = useNavigate();
  const {user, isAuthenticated, isLoading} = useAuth();

  if (isLoading){
    return (
      <div className="homepage">
        <h1>Loading...</h1>
      </div>
  )
  }

  return ( 
    <div>

      { (user) ? (
        <div className="homepage">
          <h1>Hello {user.username}</h1>

          <div className="homepage-container">
            <div className="homepage-box">
              <div className="homepage-button"
              onClick={() => navigate('/home/manage_auctions')}>
                Manage your Auctions
              </div>
              <div className="homepage-button"
              onClick={() => navigate("/home/auctions/")}
              >
                Search Auction to Bid
              </div>
            </div>
          </div>
        </div>
      ) : (
        <h1>You do not have access to this site</h1>
      )
      } 
    </div>
   );
}

export default Home;