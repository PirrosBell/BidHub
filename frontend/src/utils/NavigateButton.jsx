import {useNavigate} from "react-router-dom";

function NavigateButton({to, children}) {
    const navigate = useNavigate();
    return (<button onClick={() => navigate(to)}>{children}</button>);
}

export default NavigateButton;