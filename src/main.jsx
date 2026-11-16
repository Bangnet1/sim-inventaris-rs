import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('SIM Inventaris RS render error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#f3f7f7',fontFamily:'Arial,sans-serif',color:'#183943'}}>
          <section style={{maxWidth:520,width:'100%',background:'#fff',padding:28,borderRadius:16,boxShadow:'0 12px 40px #163a4018'}}>
            <h1 style={{fontSize:22}}>SIM Inventaris RS</h1>
            <p>Aplikasi mengalami kendala saat menampilkan halaman.</p>
            <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',padding:14,background:'#fff4f1',color:'#a33',borderRadius:8,fontSize:12}}>{String(this.state.error?.message || this.state.error)}</pre>
            <button onClick={() => window.location.reload()} style={{background:'#087f73',color:'#fff',border:0,borderRadius:8,padding:'12px 18px',fontWeight:700}}>Muat ulang aplikasi</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

window.addEventListener('error', event => console.error('SIM Inventaris RS window error:', event.error || event.message));
window.addEventListener('unhandledrejection', event => console.error('SIM Inventaris RS async error:', event.reason));

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);