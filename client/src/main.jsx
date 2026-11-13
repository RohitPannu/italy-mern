import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import Admin from './Admin.jsx';
import StudentAuth from './StudentAuth.jsx';
import StudentPortal from './StudentPortal.jsx';
import StudentRecovery from './StudentRecovery.jsx';
import StudentVerification from './StudentVerification.jsx';
const route = location.pathname;
const page = route.startsWith('/admin') ? <Admin />
	: route.startsWith('/student/dashboard') ? <StudentPortal />
		: route === '/verify-email' ? <StudentVerification />
		: route === '/student/forgot-password' || route === '/student/reset-password' || route === '/admin/forgot-password' || route === '/admin/reset-password' || route === '/reset-password' ? <StudentRecovery />
			: route.startsWith('/student') ? <StudentAuth /> : <App />;
createRoot(document.getElementById('root')).render(page);
