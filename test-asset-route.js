import express from 'express';
import assetRoutes from './routes/assetRoutes.js';

const app = express();

console.log('Asset routes object:', assetRoutes);
console.log('Asset routes type:', typeof assetRoutes);

app.use('/api/assets', assetRoutes);

app.listen(3001, () => {
  console.log('Test server running on port 3001');
});