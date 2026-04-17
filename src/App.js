import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import WorkOrders from './pages/WorkOrders';
import Equipment from './pages/Equipment';
import Sites from './pages/Sites';

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/work-orders" element={<WorkOrders />} />
            <Route path="/equipment" element={<Equipment />} />
            <Route path="/sites" element={<Sites />} />
          </Routes>
        </Layout>
      </Router>
    </I18nextProvider>
  );
}

export default App;