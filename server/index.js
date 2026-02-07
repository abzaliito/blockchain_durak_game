const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const config = require('./config');
const { setupSocketHandlers } = require('./controllers/socketController');
const blockchainService = require('./services/BlockchainService');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

setupSocketHandlers(io);

server.listen(config.PORT, async () => {
  console.log(`Server running on port ${config.PORT}`);
  await blockchainService.initialize();
});
