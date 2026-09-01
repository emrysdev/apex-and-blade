import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Services from "@/pages/Services";
import Gallery from "@/pages/Gallery";
import Contact from "@/pages/Contact";
import Book from "@/pages/Book";
import Confirmation from "@/pages/Confirmation";
import Login from "@/pages/Login";
import Account from "@/pages/Account";
import Admin from "@/pages/Admin";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/book" element={<Book />} />
              <Route path="/confirmation/:reference" element={<Confirmation />} />
              <Route path="/login" element={<Login />} />
              <Route path="/account" element={<Account />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </Layout>
          <Toaster position="top-center" theme="dark" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
