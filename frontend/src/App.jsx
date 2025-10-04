import { useState } from 'react'
import './index.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Home from "./pages/Homepage";
import Auctions from "./pages/Auctions";
import AuctionDetail from "./pages/Auction_detail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profiles from "./pages/Profiles";
import ProfileDetail from './pages/ProfileDetail';
import ManageAuctions from './pages/ManageAuctions';
import Admin from './pages/Admin';
import About from './pages/About';
import CreateAuction from './pages/CreateAuction';
import WelcomePage from './pages/Welcome';
import WaitRoom from './pages/Waiting_page';
import Layout from './Layout';
import "react-datetime/css/react-datetime.css";
import AdminUsers from './pages/AdminUsers';
import AdminRegistrations from './pages/AdminRegistrations';



function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<WelcomePage/>}/>
            <Route path="/home/auctions" element={<Auctions />} />
            <Route path="/home/auctions/:id" element={<AuctionDetail />} />
            <Route path="/home/manage_auctions" element={<ManageAuctions />}/>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<ProfileDetail />} />
            <Route path="/waiting_page" element={<WaitRoom/>} />
            <Route path="/home" element={<Home/>} />
            <Route path="/admin" element={<ProtectedRoute><Admin/></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><AdminUsers/></ProtectedRoute>} />
            <Route path="/admin/registrations" element={<ProtectedRoute><AdminRegistrations/></ProtectedRoute>} />
            <Route path="/profile/:id" element={<ProtectedRoute><ProfileDetail/></ProtectedRoute>}/>
            <Route path="/about" element={<About/>}/>
            <Route path="/create_auction" element={<ProtectedRoute><CreateAuction/></ProtectedRoute>}/>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
