import express from "express";
import cors from "cors";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import crypto from "crypto";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // M-Pesa Mozambique Integration (Vodacom)
  // Note: This is a simplified implementation. Real M-Pesa API requires RSA encryption for Session ID.
  const mpesaConfig = {
    apiKey: process.env.MPESA_API_KEY || "",
    publicKey: process.env.MPESA_PUBLIC_KEY || "",
    serviceProviderCode: process.env.MPESA_SERVICE_PROVIDER_CODE || "",
    initiatorIdentifier: process.env.MPESA_INITIATOR_IDENTIFIER || "",
    securityCredential: process.env.MPESA_SECURITY_CREDENTIAL || "",
    apiUrl: "https://api.sandbox.vm.co.mz:18352/ipg/v1x/" // Sandbox URL, change for production
  };

  // e-mola Mozambique Integration (Movitel)
  const emolaConfig = {
    apiKey: process.env.EMOLA_API_KEY || "",
    merchantId: process.env.EMOLA_MERCHANT_ID || "",
    apiUrl: process.env.EMOLA_API_URL || "https://api.emola.co.mz/v1/" // Placeholder URL
  };

  // Helper to generate M-Pesa Session ID (Requires RSA Encryption with Public Key)
  async function getMpesaSessionId() {
    try {
      // In a real implementation, you'd encrypt the API Key with the Public Key using RSA
      // For this example, we'll simulate the call
      const response = await axios.get(`${mpesaConfig.apiUrl}querySession/`, {
        headers: {
          'Origin': '*',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mpesaConfig.apiKey}` // This is usually more complex
        }
      });
      return response.data.output_SessionID;
    } catch (error) {
      console.error("M-Pesa Session ID Error:", error);
      return null;
    }
  }

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Payment Initiation Endpoint
  app.post("/api/pay", async (req, res) => {
    const { method, phone, amount, plan } = req.body;

    if (!phone || !amount || !method) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      if (method === "mpesa") {
        // M-Pesa C2B (STK Push)
        // 1. Get Session ID
        // const sessionId = await getMpesaSessionId();
        
        // 2. Initiate C2B
        // This is a mock response as real M-Pesa API requires complex setup
        // In a real app, you'd call: axios.post(`${mpesaConfig.apiUrl}c2bPayment/`, ...)
        console.log(`Initiating M-Pesa payment for ${phone} - ${amount} MZN`);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        return res.json({ 
          success: true, 
          message: "Solicitação M-Pesa enviada ao seu telemóvel. Introduza o PIN.",
          transactionId: `MP-${Date.now()}`
        });

      } else if (method === "emola") {
        // e-mola Integration
        console.log(`Initiating e-mola payment for ${phone} - ${amount} MZN`);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        return res.json({ 
          success: true, 
          message: "Solicitação e-mola enviada ao seu telemóvel. Introduza o PIN.",
          transactionId: `EM-${Date.now()}`
        });
      }

      res.status(400).json({ error: "Invalid payment method" });

    } catch (error: any) {
      console.error("Payment Error:", error.message);
      res.status(500).json({ error: "Erro ao processar pagamento" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
