const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { atlasUri, shopId } = req.body;
  
  if (!atlasUri) {
    return res.status(400).json({ error: 'Atlas URI is required' });
  }
  
  let client = null;
  
  try {
    // Connect to MongoDB Atlas
    client = new MongoClient(atlasUri);
    await client.connect();
    
    const db = client.db('pos_system');
    
    // Get bills
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
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (client) await client.close();
  }
};