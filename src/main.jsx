import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import RuntimeErrorBoundary from './components/RuntimeErrorBoundary.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RuntimeErrorBoundary><App /></RuntimeErrorBoundary>
  </StrictMode>,
)
