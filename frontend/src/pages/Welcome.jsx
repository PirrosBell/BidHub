import { Link, Navigate } from "react-router-dom";
import '../styles/Welcome.css'
import { useAuth } from "../contexts/AuthContext";


const WelcomePage = () => {
  const {user, isAuthenticated, logout} = useAuth();
  

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }



  return (
    <div className="welcome">
      <h1>Welcome to BidHub!</h1>
      <h2>
        Please <Link to="/login">sign in</Link> to continue, <br/>or {" "}
        <Link to="/register">apply</Link> for an account.
      </h2>
    </div>
  );
}

export default WelcomePage;