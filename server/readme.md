# 🎯 Gaple Game Server

Server multiplayer untuk game Gaple (Domino Indonesia) menggunakan Node.js, Socket.IO, dan MongoDB.

## 🎮 Fitur

- **Multiplayer Real-time**: 4 pemain per room menggunakan Socket.IO
- **Room System**: Buat room dan bagikan link ke pemain lain
- **Aturan Gaple Lengkap**: Sesuai aturan tradisional Indonesia dengan modifikasi custom
- **Database**: MongoDB untuk penyimpanan room dan history game
- **Responsive**: Interface yang mobile-friendly

## 🎲 Aturan Permainan

### Dasar Permainan
- 4 pemain wajib
- Menggunakan 28 kartu domino (0-0 sampai 6-6)
- Setiap pemain mendapat 7 kartu
- Max point bisa diatur (default 100)
- Pemenang adalah yang memiliki **poin terkecil** saat ada yang mencapai max point

### Aturan Pemain Pertama
1. **Round pertama**: Pemain dengan kartu 0-0
2. **Round selanjutnya**: Pemenang round sebelumnya (yang kartunya habis duluan)
3. **Kondisi Gaple**: Pemain yang memiliki kartu gaple

### Aturan Kartu Pembuka
- **Pemenang round sebelumnya**: Harus main kartu balak (0-0, 1-1, 2-2, dst) jika punya
- **Kondisi gaple**: Harus main kartu gaple yang sesuai
- **Round pertama**: Harus main kartu 0-0

### Aturan Khusus Poin
- Kartu 0-0 = **25 poin** jika tidak ada pemain lain yang memegang kartu kombinasi 0 (0-1, 0-2, dst)
- Poin normal: jumlah angka di kedua sisi kartu

### Kondisi Gaple
- Terjadi ketika semua pemain tidak bisa main dan kedua ujung papan menunjukkan angka sama
- Contoh: ujung kiri = 5, ujung kanan = 5, tidak ada yang punya kartu angka 5
- Kartu gaple = kartu kembar sesuai angka ujung (contoh: 5-5)

## 🚀 Instalasi

### Prerequisites
- Node.js (v14+)
- MongoDB
- npm atau yarn

### Setup Database
```bash
# Install dan jalankan MongoDB
# Ubuntu/Debian:
sudo apt-get install mongodb
sudo systemctl start mongodb

# macOS dengan Homebrew:
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Windows: Download dari https://www.mongodb.com/try/download/community
```

### Install Dependencies
```bash
# Clone repository (atau copy files)
git clone <repository-url>
cd gaple-game-server

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env sesuai kebutuhan
nano .env
```

### Menjalankan Server
```bash
# Development mode (dengan nodemon)
npm run dev

# Production mode
npm start
```

Server akan berjalan di `http://localhost:3000`

## 📁 Struktur Project

```
gaple-game-server/
├── server.js              # Main server file
├── package.json           # Dependencies
├── .env.example          # Environment variables template
├── README.md             # Documentation
├── public/               # Static files (HTML, CSS, JS)
│   ├── index.html        # Game interface
│   ├── client-socket.js  # Client Socket.IO integration
│   └── assets/           # Images, fonts, etc.
└── logs/                 # Server logs
```

## 🌐 API Endpoints

### HTTP Endpoints
- `GET /health` - Health check server
- `GET /` - Serve game interface

### Socket.IO Events

#### Client → Server
- `createRoom` - Buat room baru
- `joinRoom` - Join room dengan ID
- `startGame` - Mulai game (host only)
- `playCard` - Main kartu
- `passMove` - Pass (tidak bisa main)
- `leaveRoom` - Keluar dari room

#### Server → Client
- `roomCreated` - Room berhasil dibuat
- `roomJoined` - Berhasil join room
- `gameStarted` - Game dimulai
- `gameUpdate` - Update state game
- `newRoundStarted` - Round baru dimulai
- `gameEnded` - Game selesai
- `playerJoined` - Ada pemain baru
- `playerLeft` - Ada pemain keluar
- `error` - Error message

## 🎯 Cara Bermain

1. **Buka browser** ke `http://localhost:3000`
2. **Masukkan nama** pemain
3. **Buat room** atau **join room** dengan ID
4. **Tunggu 4 pemain** lengkap
5. **Host memulai game**
6. **Mainkan kartu** sesuai giliran dan aturan
7. **Pemenang** ditentukan saat ada yang mencapai max point

### Tips Bermain
- Perhatikan aturan kartu pembuka setiap round
- Kartu 0-0 bisa jadi 25 poin - hati-hati!
- Strategi: buang kartu dengan poin tinggi dulu
- Kondisi gaple bisa menguntungkan jika Anda punya kartu gaple

## 🔧 Konfigurasi

### Environment Variables
```bash
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/gaple-game

# Game Settings
DEFAULT_MAX_POINTS=100
ROOM_CLEANUP_INTERVAL_MS=1800000

# Security
RATE_LIMIT_MAX_REQUESTS=100
```

### Game Settings
- Max points bisa diubah per game
- Room otomatis dibersihkan setelah 30 menit tidak aktif
- Rate limiting untuk mencegah spam

## 🐛 Troubleshooting

### MongoDB Connection Error
```bash
# Pastikan MongoDB berjalan
sudo systemctl status mongodb

# Atau cek log MongoDB
tail -f /var/log/mongodb/mongod.log
```

### Socket.IO Connection Issues
- Pastikan port 3000 tidak digunakan aplikasi lain
- Cek firewall settings
- Update URL server di client code

### Performance Issues
- Monitor dengan `GET /health` endpoint
- Check MongoDB performance
- Consider using Redis for session storage

## 🚀 Deployment

### Production Setup
```bash
# Install PM2 untuk process management
npm install -g pm2

# Start dengan PM2
pm2 start server.js --name gaple-game

# Auto restart on reboot
pm2 startup
pm2 save
```

### Docker Setup
```dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables Production
```bash
NODE_ENV=production
MONGODB_URI=mongodb://your-mongodb-url/gaple-game
PORT=3000
```

## 📊 Database Schema

### Rooms Collection
```javascript
{
  roomId: String,        // Unique room ID
  players: [Player],     // Array of player objects
  gameState: GameState,  // Current game state
  createdAt: Date,
  updatedAt: Date
}
```

### Game History Collection
```javascript
{
  roomId: String,
  players: [String],     // Player names
  winner: String,        // Winner name
  finalScores: [Score],  // Final scores
  rounds: Number,
  duration: Number,
  completedAt: Date
}
```

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Create Pull Request

## 📝 License

MIT License - lihat file LICENSE untuk detail.

## 🎮 Credits

Game Gaple adalah permainan tradisional Indonesia. Server ini dibuat untuk tujuan edukasi dan hiburan.

---

**Selamat bermain Gaple! 🎯🎲**