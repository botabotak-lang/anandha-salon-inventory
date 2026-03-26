import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ServicesPage } from "./pages/ServicesPage";
import { StockPage } from "./pages/StockPage";
import { SalesPage } from "./pages/SalesPage";
import { SaleNewPage } from "./pages/SaleNewPage";
import { SaleDetailPage } from "./pages/SaleDetailPage";
import { MonthlyPage } from "./pages/MonthlyPage";
import { CsvPage } from "./pages/CsvPage";
import { Layout } from "./Layout";
import { AccountPage } from "./pages/AccountPage";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA は任意機能のため、登録失敗でも画面機能は継続する
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <Layout>
              <DashboardPage />
            </Layout>
          }
        />
        <Route
          path="/products"
          element={
            <Layout>
              <ProductsPage />
            </Layout>
          }
        />
        <Route
          path="/services"
          element={
            <Layout>
              <ServicesPage />
            </Layout>
          }
        />
        <Route
          path="/stock"
          element={
            <Layout>
              <StockPage />
            </Layout>
          }
        />
        <Route
          path="/sales"
          element={
            <Layout>
              <SalesPage />
            </Layout>
          }
        />
        <Route
          path="/sales/new"
          element={
            <Layout>
              <SaleNewPage />
            </Layout>
          }
        />
        <Route
          path="/sales/:id"
          element={
            <Layout>
              <SaleDetailPage />
            </Layout>
          }
        />
        <Route
          path="/monthly"
          element={
            <Layout>
              <MonthlyPage />
            </Layout>
          }
        />
        <Route
          path="/csv"
          element={
            <Layout>
              <CsvPage />
            </Layout>
          }
        />
        <Route
          path="/account"
          element={
            <Layout>
              <AccountPage />
            </Layout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
