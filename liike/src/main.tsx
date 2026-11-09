import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ReceiptStudio from './ReceiptStudio';
import './style.css';

export function Root() {
  const [receipt, setReceipt] = useState(location.hash === '#receipt');
  useEffect(() => {
    const change = () => setReceipt(location.hash === '#receipt');
    addEventListener('hashchange', change);
    return () => removeEventListener('hashchange', change);
  }, []);
  return receipt ? <ReceiptStudio /> : <App />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
