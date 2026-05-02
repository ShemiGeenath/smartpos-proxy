const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Proxy endpoint - receives Atlas URI and returns shop data
app.post('/api/data', async (req, res) => {
  const { atlasUri, shopId } = req.body;
  
  console.log('📊 Request received for shop:', shopId);
  
  if (!atlasUri) {
    return res.status(400).json({ error: 'Atlas URI is required' });
  }
  
  let client = null;
  
  try {
    // Connect to MongoDB Atlas
    client = new MongoClient(atlasUri);
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = client.db('pos_system');
    
    // Get bills (last 500)
    const bills = await db.collection('bills')
      .find({})
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
    
    // Get products
    const products = await db.collection('products')
      .find({})
      .toArray();
    
    // Calculate summary
    const sales = bills.filter(b => b.type !== 'return' && b.type !== 'exchange');
    const returns = bills.filter(b => b.type === 'return');
    const exchanges = bills.filter(b => b.type === 'exchange');
    
    const totalRevenue = sales.reduce((sum, b) => sum + (b.total || 0), 0);
    const totalReturns = returns.reduce((sum, b) => sum + Math.abs(b.refundAmount || b.total || 0), 0);
    
    console.log(`✅ Retrieved ${bills.length} bills, ${products.length} products`);
    
    res.json({
      success: true,
      bills,
      products,
      summary: {
        totalRevenue,
        totalReturns,
        netRevenue: totalRevenue - totalReturns,
        transactionCount: bills.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ 
      error: error.message,
      hint: 'Check your Atlas connection string and network access'
    });
  } finally {
    if (client) await client.close();
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'SmartPOS Proxy Server',
    usage: 'POST to /api/data with { atlasUri, shopId }'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 SmartPOS Proxy Server Running`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   Endpoint: POST /api/data`);
  console.log(`\n   Deploy this to Cyclic.sh for production!\n`);
});